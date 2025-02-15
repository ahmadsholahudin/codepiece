const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const { handleCommand } = require('./handler');

const pairingCode = true;
const contactsMap = new Map(); // Menyimpan daftar nama kontak

const question = (text) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const sock = makeWASocket({
        printQRInTerminal: !pairingCode,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', ''],
        markOnlineOnConnect: true,
        auth: state
    });

    if (pairingCode && !sock.authState.creds.registered) {
        const phoneNumber = await question('Please input your WhatsApp number: \n');
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`Pairing code: ${code}`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log('❌ Koneksi terputus. Penyebab:', lastDisconnect?.error);

            if (shouldReconnect) {
                console.log('🔄 Mencoba menyambungkan kembali...');
                startBot(); // Restart bot jika bukan kesalahan autentikasi
            } else {
                console.log('⛔ Tidak bisa menyambungkan kembali. Silakan hapus folder "session" dan login ulang.');
            }
        }

        if (connection === 'open') {
            console.log('✅ Terhubung ke WhatsApp sebagai:', sock.user.id.split(':')[0]);
        }
    });

    // **Event untuk memperbarui daftar kontak**
    sock.ev.on('contacts.update', (contacts) => {
        contacts.forEach((contact) => {
            if (contact.id && contact.notify) {
                contactsMap.set(contact.id, contact.notify); // Simpan nama kontak
            }
        });
    });

    // **Event saat menerima pesan baru**
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        const type = Object.keys(m.message)[0];
        const pesan =
            type === 'conversation' ? m.message.conversation :
            type === 'extendedTextMessage' ? m.message.extendedTextMessage.text :
            type === 'imageMessage' ? m.message.imageMessage.caption :
            '';

        if (m.key.fromMe || !pesan.startsWith('.')) return;

        const args = pesan.slice(1).split(' ');
        const command = args[0].toLowerCase();
        const sender = m.key.remoteJid;

        // Ambil nama pengguna dari daftar kontak, jika tidak ada gunakan nomor
        const senderName = contactsMap.get(sender) || sender.split('@')[0];

        // **Log pesan masuk ke terminal dengan nama**
        console.log(`📩 Pesan masuk dari ${senderName}: ${pesan}`);

        // **Panggil handler untuk memproses command**
        const response = await handleCommand(command, args, sender, sock, m);

        // **Log balasan ke terminal dengan nama**
        console.log(`📤 Balasan ke ${senderName}: ${response}`);
    });

    sock.ev.on('group-participants.update', ({ grup }) => {
        console.log(grup);
    });
}

startBot();
