const express = require('express');
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const app = express();

app.use(cors());
app.use(bodyParser.json());
const PORT = 3000;
require("dotenv").config();

async function dbconnect() {
    try {
        const mongourl = "mongodb+srv://Dheena:dheena123@cluster0.ser6ewc.mongodb.net/Smarttransit?retryWrites=true&w=majority&appName=Cluster0";
        await mongoose.connect(mongourl);
        console.log("Connected to MongoDB");
    } catch (e) {
        console.log("Error in connecting to the database: " + e);
    }
}

dbconnect();

const ticketSchema = new mongoose.Schema({
    source: String,
    destination: String,
    email: String,
    routeno: Number
});

const Ticket = mongoose.model('Ticket', ticketSchema);

app.post("/counter", async (req, res) => {
    try {
        const { source, destination, email, routeno } = req.body;
        const ticket = new Ticket({ source, destination, email, routeno });
        const savedTicket = await ticket.save();
        
        res.send({ id: savedTicket._id });
    } catch (e) {
        console.log(e);
        res.status(500).send("Error creating ticket");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
