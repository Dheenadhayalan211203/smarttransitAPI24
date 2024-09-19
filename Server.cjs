const express = require("express");
const mongoose = require("mongoose");
const cors = require('cors');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect("mongodb+srv://Dheena:dheena123@cluster0.ser6ewc.mongodb.net/Smarttransit?retryWrites=true&w=majority&appName=Cluster0", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("Connected to database"))
  .catch((err) => console.error(err));

const connection = mongoose.connection;
connection.once('open', () => console.log("MongoDB Connected..."));

// Schema definitions
const stopSchema = new mongoose.Schema({
    Route: [Array],
    StopName: String,
    latitude: Number,
    longitude: Number,
    NoOfpassenger: Number
}, { collection: 'stops' });

const busDataSchema = new mongoose.Schema({
    busid: Number,
    routeno: Number,
    location: {
        latitude: Number,
        longitude: Number
    },
    dutystatus: Boolean,
    staticseatcount: Number,
    currentseatcountfilled: Number
}, { collection: 'busdata' });

const ticketSchema = new mongoose.Schema({
    source: String,
    destination: String,
    email: String,
    routeno: Number
});

const Ticket = mongoose.model('tickets', ticketSchema);
const Stop = mongoose.model('stops', stopSchema);
const BusData = mongoose.model('BusData', busDataSchema);

const swap = str => {
    let arr = str.split('');
    for (let i = 0; i < arr.length - 1; i += 2) {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    }
    return arr.join('');
};

// Adding ticket
app.post("/counter", async (req, res) => {
    try {
        const { source, destination, email, routeno } = req.body;
        const savedTicket = await new Ticket({ source, destination, email, routeno }).save();
        const hashedDetails = crypto.createHash('sha256').update(swap(savedTicket._id.toString())).digest('hex');
        
        QRCode.toDataURL(hashedDetails, { errorCorrectionLevel: 'H' }, (err, url) => {
            if (err) return res.status(500).send("Error generating QR code");
            res.json({ qrCode: url });
        });
    } catch (e) {
        console.error(e);
        res.status(500).send("Error creating ticket");
    }
});

// Verify the passenger before travel
app.post("/verify", async (req, res) => {
    try {
        const { hashedId } = req.body;
        const tickets = await Ticket.find();
        const matchedTicket = tickets.find(ticket => {
            const ticketHash = crypto.createHash('sha256').update(swap(ticket._id.toString())).digest('hex');
            return ticketHash === hashedId;
        });
        
        if (!matchedTicket) return res.json("No Ticket");
        
        const count = await Ticket.findById(matchedTicket);
        if (count.__v === 0) {
            await Ticket.findByIdAndUpdate(matchedTicket, { __v: 1 });
            return res.json("Passenger Boarded");
        } else if (count.__v === 1) {
            await Ticket.findByIdAndUpdate(matchedTicket, { __v: 2 });
            return res.json("Travel completed");
        } else {
            return res.json("Ticket already used");
        }
    } catch (error) {
        console.error("Error during verification:", error);
        res.status(500).send("Verification failed");
    }
});

// Haversine formula to calculate the distance between two points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = val => val * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); // Earth radius = 6371 km
};

// Route to find the minimum distance between any bus and stop
app.get('/min-distance', async (req, res) => {
    try {
        const stops = await Stop.find();
        const buses = await BusData.find();
        if (!stops.length || !buses.length) return res.status(404).json({ message: "No stops or bus data available" });

        const min = buses.flatMap(bus => {
            if (!bus.location || bus.dutystatus) return [];
            return stops
                .filter(stop => stop.Route.includes(bus.routeno) && stop.latitude && stop.longitude)
                .map(stop => ({
                    bus: { busid: bus.busid, routeno: bus.routeno, location: bus.location },
                    stop: { StopName: stop.StopName, location: { latitude: stop.latitude, longitude: stop.longitude } },
                    distance: calculateDistance(bus.location.latitude, bus.location.longitude, stop.latitude, stop.longitude)
                }))
                .sort((a, b) => a.distance - b.distance)[0];
        }).filter(Boolean);

        if (!min.length) return res.status(404).json({ message: "No matching bus and stop pairs found" });
        res.json(min);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
