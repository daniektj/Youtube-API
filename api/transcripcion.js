import axios from 'axios';
import * as cheerio from 'cheerio';

function procesarTranscripcion(transcripcionXML) {
    const $ = cheerio.load(transcripcionXML, { xmlMode: true });
    
    // Extraer todos los textos con sus tiempos
    const segmentos = $('text').map((_, el) => ({
        texto: $(el).text(),
        inicio: parseFloat($(el).attr('start')),
        duracion: parseFloat($(el).attr('dur'))
    })).get();

    // Crear texto completo
    const textoCompleto = segmentos.map(s => s.texto).join(' ');

    // Crear resumen por tiempo
    const duracionTotal = segmentos[segmentos.length - 1].inicio + segmentos[segmentos.length - 1].duracion;
    const minutos = Math.floor(duracionTotal / 60);
    
    // Dividir en secciones de aproximadamente 1 minuto
    const secciones = [];
    let seccionActual = [];
    let tiempoActual = 0;

    segmentos.forEach(segmento => {
        seccionActual.push(segmento.texto);
        tiempoActual += segmento.duracion;
        
        if (tiempoActual >= 60) {
            secciones.push(seccionActual.join(' '));
            seccionActual = [];
            tiempoActual = 0;
        }
    });
    
    if (seccionActual.length > 0) {
        secciones.push(seccionActual.join(' '));
    }

    return {
        transcripcion_completa: textoCompleto,
        duracion_total: {
            segundos: duracionTotal,
            minutos: minutos,
            formato: `${minutos}:${Math.floor((duracionTotal % 60)).toString().padStart(2, '0')}`
        },
        secciones_por_minuto: secciones,
        metadata: {
            numero_segmentos: segmentos.length,
            palabras_totales: textoCompleto.split(' ').length,
            tiempo_promedio_segmento: duracionTotal / segmentos.length
        },
        segmentos_raw: segmentos
    };
}

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
                        throw new Error("No se encontraron transcripciones para este video.");
                    }

                    // Buscar transcripción en español o usar la primera disponible
                    const track = transcript_tracks.find(t => t.languageCode === 'es') || transcript_tracks[0];
                    const transcriptResponse = await axios.get(track.baseUrl);
                    return procesarTranscripcion(transcriptResponse.data);
                } catch (jsonError) {
                    throw new Error("Error al procesar la respuesta de YouTube: " + jsonError.message);
                }
            }
        }
        throw new Error("No se encontró la configuración del reproductor.");
    } catch (error) {
        throw new Error("Error en la solicitud: " + error.message);
    }
}

export const config = {
    runtime: 'edge'
};

export default async function handler(req) {
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
        const resultado = await obtenerTranscripcion(urlVideo);
        return new Response(
            JSON.stringify(resultado),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ 
                error: error.message,
                tipo: 'error_transcripcion'
            }),
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
