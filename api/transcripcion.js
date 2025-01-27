import axios from 'axios';
import * as cheerio from 'cheerio';

async function obtenerTranscripcion(urlVideo) {
    try {
        const response = await axios.get(urlVideo);
        const $ = cheerio.load(response.data);

        const scriptTag = $('script').filter((i, el) => {
            return $(el).text().includes('ytInitialPlayerResponse');
        });

        if (scriptTag.length > 0) {
            const scriptContent = scriptTag.text();
            const regex = /ytInitialPlayerResponse\s*=\s*({.+?});/;
            const match = scriptContent.match(regex);

            if (match) {
                try {
                    const ytInitialPlayerResponse = JSON.parse(match[1]);
                    const transcript_tracks = ytInitialPlayerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

                    if (!transcript_tracks) {
                        return "No se encontraron transcripciones para este video.";
                    }

                    for (const track of transcript_tracks) {
                        if (track.languageCode === 'es') {
                            const transcriptResponse = await axios.get(track.baseUrl);
                            return transcriptResponse.data;
                        }
                    }
                    const transcriptResponse = await axios.get(transcript_tracks[0].baseUrl);
                    return transcriptResponse.data;
                } catch (jsonError) {
                    console.error("Error al parsear JSON:", jsonError);
                    return "Error al procesar la respuesta de YouTube.";
                }
            }
        }
        return "No se encontró la configuración del reproductor.";
    } catch (error) {
        console.error("Error en la solicitud:", error);
        return "Error en la solicitud a YouTube.";
    }
}

export const config = {
    runtime: 'edge'
};

export default async function handler(req) {
    // Verificar el método
    if (req.method !== 'GET') {
        return new Response(
            JSON.stringify({ error: 'Método no permitido' }),
            {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET,OPTIONS'
                }
            }
        );
    }

    // Obtener la URL del video de los parámetros de consulta
    const url = new URL(req.url);
    const urlVideo = url.searchParams.get('url');

    if (!urlVideo) {
        return new Response(
            JSON.stringify({ error: 'Falta el parámetro "url".' }),
            {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    }

    try {
        const transcripcion = await obtenerTranscripcion(urlVideo);
        return new Response(
            JSON.stringify({ transcripcion }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: 'Error al procesar la solicitud' }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    }
}
