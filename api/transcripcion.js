const axios = require('axios');
const cheerio = require('cheerio');

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

// Export a function that handles the request
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Handle actual request
    if (req.method === 'GET') {
        const urlVideo = req.query.url;

        if (!urlVideo) {
            return res.status(400).json({ error: 'Falta el parámetro "url".' });
        }

        try {
            const transcripcion = await obtenerTranscripcion(urlVideo);
            return res.status(200).json({ transcripcion });
        } catch (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: 'Error al procesar la solicitud' });
        }
    } else {
        return res.status(405).json({ error: 'Método no permitido' });
    }
}
