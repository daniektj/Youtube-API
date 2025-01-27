const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

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
                        if (track.languageCode === 'es') { // Priorizar español
                            const transcriptResponse = await axios.get(track.baseUrl);
                            return transcriptResponse.data;
                        }
                    }
                    // Si no hay español, devolver la primera transcripción disponible
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

app.get('/api/transcripcion', async (req, res) => {
    const urlVideo = req.query.url;

    if (!urlVideo) {
        return res.status(400).json({ error: 'Falta el parámetro "url".' });
    }

    const transcripcion = await obtenerTranscripcion(urlVideo);
    res.json({ transcripcion });
});

app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});