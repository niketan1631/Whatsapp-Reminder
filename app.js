require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const schedule = require("node-schedule");
const Excel = require("exceljs");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ------------------ WHATSAPP CLIENT ------------------
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
});

client.on("qr", qr => {
    console.log("\nSCAN THIS QR CODE TO CONNECT WHATSAPP:\n");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("✅ WhatsApp Connected!");
});

client.initialize();


// ------------------ EXCEL SETUP ------------------
const excelPath = path.join(__dirname, "clients.xlsx");
const workbook = new Excel.Workbook();
let sheet;

async function initExcel() {
    try {
        await workbook.xlsx.readFile(excelPath);
        sheet = workbook.getWorksheet(1);
    } catch {
        workbook.addWorksheet("Clients");
        sheet = workbook.getWorksheet(1);
        sheet.columns = [
            { header: "Name", key: "name" },
            { header: "Phone", key: "phone" },
            { header: "Appointment", key: "appointment" },
            { header: "Message", key: "message" }
        ];
        await workbook.xlsx.writeFile(excelPath);
    }
}
initExcel();


// ------------------ SEND WHATSAPP ------------------
async function sendWhatsApp(phone, message) {
    try {
        const formatted = phone + "@c.us";
        console.log("📨 Sending to:", formatted);

        await client.sendMessage(formatted, message);

        console.log("✅ Message Sent!");
    } catch (err) {
        console.log("❌ Error sending message:", err.message);
    }
}


// ------------------ FIXED DATE PARSER ------------------
function buildValidDate(date, time) {
    const [year, month, day] = date.split("-");
    const [hour, minute] = time.split(":");

    return new Date(year, month - 1, day, hour, minute, 0);
}


// ------------------ SCHEDULE REMINDER ------------------
function scheduleReminder(name, phone, date, time, msg) {
    const dateObj = buildValidDate(date, time);

    console.log("⏳ Reminder Scheduled For:", name, dateObj);

    schedule.scheduleJob(dateObj, () => {
        console.log("⏰ Reminder Triggered For:", name);
        sendWhatsApp(phone, msg);
    });
}


// ------------------ API: ADD CLIENT ------------------
app.post("/add-client", async (req, res) => {
    const { name, phone, date, time, message } = req.body;

    sheet.addRow({ name, phone, appointment: `${date} ${time}`, message });
    await workbook.xlsx.writeFile(excelPath);

    scheduleReminder(name, phone, date, time, message);

    res.json({ message: "Saved & Reminder Scheduled!" });
});


// ------------------ FRONTEND ------------------
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});


// ------------------ SERVER ------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Running at http://localhost:${PORT}`);
});

// for open type node app.js in terminal.