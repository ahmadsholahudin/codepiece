const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
// const moment = require('moment-timezone');
// const ytdl = require('distube/ytdl-core');
const config = require('./config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const ownerFile = './database/owner.json';
const premiumFile = './database/premium.json';
const thumbnailPath = path.join(__dirname, 'src', 'img.jpg');

const geminiKey = config.GEMINI_API_KEY; // Ambil API key dari config.js

// Fungsi untuk memeriksa apakah pengirim adalah owner
const isOwner = (sender) => {
    const ownerList = JSON.parse(fs.readFileSync(ownerFile, 'utf-8'));
    const cleanSender = sender.endsWith('@s.whatsapp.net') ? sender : `${sender}@s.whatsapp.net`;
    return ownerList.includes(cleanSender);
};

// Fungsi untuk mendapatkan respon AI dari Google Gemini API
const getAIResponse = async (query) => {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: query }] }]
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            return "⚠ AI tidak memberikan jawaban!";
        }

    } catch (error) {
        console.error("❌ Error:", error);
        return `⚠ Terjadi kesalahan: ${error.message}`;
    }
};

const handleCommand = async (command, args, sender, sock, m) => {
    const senderName = m.pushName || sender.split('@')[0];
    const device = m.key.id.length > 21 ? 'Android' : 'iPhone';
    let response = ''; // Default response

    switch (command) {
        case 'menu':
            response = `╔━━「 *BOT INFO* 」━━▢
┃ *☏ Bot Name :* ZETA V1
┃ *♙ Prefix :* [ . ]
┃ *♗ Version :* V 1.0.0
╚━━━━━━━━━━━▢
╔━━「 *USER INFO* 」━━▢
┃ *♙ Name :* ${senderName}
┃ *☏ Number :* ${sender.split('@')[0]}
┃ *⚿ Device :* ${device}
╚━━━━━━━━━━━▢
╔━━「 *Main Menu* 」━━▢
┃ *[ ⌬ ] .menu*
┃ *[ ⌬ ] .info*
┃ *[ ⌬ ] .help*
┃ *[ ⌬ ] .owner*
┃ *[ ⌬ ] .listpremium*
┃ *[ ⌬ ] .ai <query>*
┃ *[ ⌬ ] .addowner <nomor>*
┃ *[ ⌬ ] .addpremium <nomor>*
╚━━━━━━━━━━━▢`;

            if (fs.existsSync(thumbnailPath)) {
                await sock.sendMessage(sender, {
                    image: fs.readFileSync(thumbnailPath),
                    caption: response
                }, { quoted: m });
            } else {
                await sock.sendMessage(sender, { text: response }, { quoted: m });
            }
            return response;

        case 'ai':
            if (args.length < 2) {
                response = "⚠ Format salah! Gunakan: `.ai <pertanyaan>`";
                await sock.sendMessage(sender, { text: response }, { quoted: m });
                return response;
            }
            const query = args.slice(1).join(" ");
            response = await getAIResponse(query);
            await sock.sendMessage(sender, { text: `🤖 AI:\n${response}` }, { quoted: m });
            return response;

        case 'setthumbnail':
            if (!isOwner(sender)) {
                response = '❌ Kamu bukan owner!';
                await sock.sendMessage(sender, { text: response }, { quoted: m });
                return response;
            }

            if (!m.message?.imageMessage) {
                response = '⚠ Kirim gambar dengan caption `.setthumbnail`!';
                await sock.sendMessage(sender, { text: response }, { quoted: m });
                return response;
            }

            const buffer = await downloadMediaMessage(m, "buffer", {}, { reuploadRequest: sock.updateMediaMessage });

    fs.writeFileSync(thumbnailPath, buffer);
    response = '✅ Thumbnail berhasil diperbarui!';
    await sock.sendMessage(sender, { text: response }, { quoted: m });
    return response;

        case 'owner':
            response = "📞 Mengirim kontak owner...";
            await sock.sendMessage(sender, {
                contacts: {
                    displayName: "Owner Bot",
                    contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Owner Bot\nTEL;type=CELL:+6285269815926\nEND:VCARD` }]
                }
            }, { quoted: m });
            return response;

        case 'info':
            response = `🤖 *Bot WhatsApp Info* 🤖
    
✅ *Nama Bot:* ZETA V1
📌 *Versi:* 1.0.0
👨‍💻 *Developer:* Ahmad Sholahudin
📅 *Tanggal Pembuatan:* 2025
🔗 *Powered by:* @whiskeysockets/baileys

Gunakan *.menu* untuk melihat daftar perintah.`;
            await sock.sendMessage(sender, { text: response }, { quoted: m });
            return response;

        case 'help':
            response = '💡 Gunakan prefix `.` untuk menjalankan command.\nContoh: `.menu`, `.info`, `.ai <pertanyaan>`';
            await sock.sendMessage(sender, { text: response }, { quoted: m });
            return response;
            
      // case 'play':
      // case 'sticker':
      // case 'open':
      // case 'close':

        default:
            response = '⚠ Command tidak dikenali!';
            await sock.sendMessage(sender, { text: response }, { quoted: m });
            return response;
    }
};

module.exports = { handleCommand };