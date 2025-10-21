const express = require('express');
require('dotenv').config({ path: 'config.env'});
const app = express();
const gameRoutes = require('./routes/game');

const PORT = process.env.PORT || 5000;

const cors = require('cors');
app.use(cors(
    {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization']
    }
));
app.use(express.json());
app.use('/', gameRoutes);


app.get('/', (req, res) => {
    res.send('Hello World');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})
