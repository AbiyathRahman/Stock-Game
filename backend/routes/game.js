const express = require('express');
const gameRoutes = express.Router();
const api_key = process.env.POLYGON_API;
const axios = require('axios');
const app = express();
app.use(express.json());
const randomDate = require('../game-logic/gameLogic');
const { parse } = require('path');
let gameStarted = false;

// game state
let gameState = {
    ticker: "",
    startDate: "",
    currentDayIndex: 0,
    prices: [],
    bank: 10000,
    shares: 0,
    history: [],
}



// helper function to get historic data from range
const fetchHistoricData = async (symbol, startDate, endDate) => {
    if(!symbol || !startDate || !endDate){
        throw new Error('Missing required parameters: symbol, startDate, endDate');
    }
    try{
        const response = await axios.get(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${startDate}/${endDate}?apiKey=${api_key}`);
        if(response.status !== 200){
            throw new Error(`Error fetching data: ${response.statusText}`);
        }
        const data = response.data.results.slice(-7).map(item => ({
            finalPrice: item.c,
            date: new Date(item.t).toISOString().split('T')[0]
        }));
        return data;
    }catch(error){
        throw error;
    }
}
// test to fetch polygon api data
// gameRoutes.get('/test-polygon', async (req, res) => {
//     const symbol = req.query.symbol;
//     const startDate = req.query.startDate;
//     const endDate = req.query.endDate;
//     try{
//         const data = await fetchHistoricData(symbol, startDate, endDate);
//         res.json(data);
//     }catch(error){
//         const status = error.response ? error.response.status : 500;
//         res.status(status).json({ error: error.message});
//     }
// });

gameRoutes.post('/start-game', async (req, res) => {
    const { ticker } = req.body;
    const {startDate, endDate } = randomDate.getRandomDate();
    gameStarted = true;
    try{
        const prices = await fetchHistoricData(ticker, startDate, endDate);
        if(prices.length === 0){
            return res.status(400).json({ error: 'No data found. Enter valid ticker symbol.'});
        }
        gameState = {...gameState, prices, ticker, startDate};
    } catch(error){
        return res.status(500).json({ error: error.message });
    }
    
    res.json(gameState);
});

gameRoutes.post('/action', (req, res) => {
    const {action, amount} = req.body;
    const currentPrice = gameState.prices[gameState.currentDayIndex].finalPrice;
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount specified.' });
    }
    if (isNaN(currentPrice) || currentPrice <= 0) {
        return res.status(400).json({ error: 'Invalid stock price.' });
    }
    if(gameStarted === false){
        return res.status(400).json({error: 'Game has not started. Please start a game by entering a valid ticker symbol.'});
    }
    if(action === 'buy'){
        const totalCost = parseFloat((currentPrice * amount).toFixed(2));
        if(totalCost > gameState.bank){
            return res.status(400).json({ error: 'Insufficient funds to complete purchase.'});
        }
        gameState.bank = parseFloat((gameState.bank - totalCost).toFixed(2));
        gameState.shares += amount;
        gameState.history.push({ action: 'buy', amount, price: currentPrice, date: gameState.prices[gameState.currentDayIndex].date });
        res.json({message: 'Purchase successful', bank: gameState.bank, shares: gameState.shares });
        

    }
    else if(action === 'sell'){
        if(amount > gameState.shares){
            return res.status(400).json({ error: 'Insufficient shares to complete sale.'});
        }
        gameState.bank = parseFloat((gameState.bank + currentPrice * amount).toFixed(2));
        gameState.shares -= amount;
        gameState.history.push({ action: 'sell', amount, price: currentPrice, date: gameState.prices[gameState.currentDayIndex].date });
        res.json({message: 'Sale successful', bank: gameState.bank, shares: gameState.shares });
    }
    else if(action === 'hold'){
        gameState.history.push({ action: 'hold', amount: gameState.shares, price: currentPrice, date: gameState.prices[gameState.currentDayIndex].date });
        res.json({message: 'Hold successful', bank: gameState.bank, shares: gameState.shares});
    }
    else if(action === 'quit'){
        gameState.bank += parseFloat((currentPrice * gameState.shares).toFixed(2));
        gameState.shares = 0;
        gameStarted = false;
        gameState.history.push({ action: 'quit', amount: gameState.shares, price: currentPrice, date: gameState.prices[gameState.currentDayIndex].date });
        res.json({message: 'Game ended', bank: gameState.bank, shares: gameState.shares});
    }
    else {
        return res.status(400).json({ error: 'Invalid action specified.' });
    };
    

});

gameRoutes.post('/next-day', (req, res) => {
    if (!gameStarted) {
        return res.status(400).json({ error: 'Game has not started. Please start a game by entering a valid ticker symbol.' });
    }

    gameState.currentDayIndex += 1;

    if (gameState.currentDayIndex < gameState.prices.length) {
        return res.json({
            message: 'Moved to next day.',
            currentDayIndex: gameState.currentDayIndex,
            currentPrice: gameState.prices[gameState.currentDayIndex],
            bank: gameState.bank,
            shares: gameState.shares,
        });
    }

    // If we've reached here, the game is over
    gameStarted = false;
    return res.json({
        message: 'Game ended. No more data available.',
        gameState,
    });
});

module.exports = gameRoutes;