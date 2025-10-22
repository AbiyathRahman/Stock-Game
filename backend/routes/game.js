const express = require('express');
const gameRoutes = express.Router();
const api_key = process.env.POLYGON_API;
const axios = require('axios');
const randomDate = require('../game-logic/gameLogic');
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

// Start game route
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

// Action route: buy, sell, hold, quit
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
    // Buy Action
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
    // Sell Action
    else if(action === 'sell'){
        if(amount > gameState.shares){
            return res.status(400).json({ error: 'Insufficient shares to complete sale.'});
        }
        gameState.bank = parseFloat((gameState.bank + currentPrice * amount).toFixed(2));
        gameState.shares -= amount;
        gameState.history.push({ action: 'sell', amount, price: currentPrice, date: gameState.prices[gameState.currentDayIndex].date });
        res.json({message: 'Sale successful', bank: gameState.bank, shares: gameState.shares });
    }
    // Hold Action
    else if(action === 'hold'){
        gameState.history.push({ action: 'hold', amount: gameState.shares, price: currentPrice, date: gameState.prices[gameState.currentDayIndex].date });
        res.json({message: 'Hold successful', bank: gameState.bank, shares: gameState.shares});
    }
    // Quit Action
    else if (action === 'quit') {
    const soldShares = gameState.shares;
    gameState.bank += parseFloat((currentPrice * soldShares).toFixed(2));
    gameState.shares = 0;
    gameStarted = false;

    const profitLoss = parseFloat((gameState.bank - 10000).toFixed(2));

    gameState.history.push({
        action: 'quit',
        amount: soldShares,
        price: currentPrice,
        date: gameState.prices[gameState.currentDayIndex].date
    });
    // Summary Response
    res.json({
        message: 'Game ended',
        gameOver: true,
        summary: {
            finalBalance: parseFloat(gameState.bank.toFixed(2)),
            finalStockValue: 0,
            totalPortfolioValue: parseFloat(gameState.bank.toFixed(2)),
            profitLoss,
            daysPlayed: gameState.currentDayIndex + 1
        }
    });
    }
    // Invalid Action
    else {
        return res.status(400).json({ error: 'Invalid action specified.' });
    };
    

});

// Next day route
gameRoutes.post('/next-day', (req, res) => {
    if (!gameStarted) {
        return res.status(400).json({ error: 'Game has not started. Please start a game by entering a valid ticker symbol.' });
    }

    gameState.currentDayIndex += 1;

    if (gameState.currentDayIndex < gameState.prices.length) {
        return res.json({
            message: 'Moved to next day.',
            currentDayIndex: gameState.currentDayIndex,
            currentPrice: gameState.prices[gameState.currentDayIndex].finalPrice,
            currentPriceDate: gameState.prices[gameState.currentDayIndex].date,
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

// Return current game state
gameRoutes.get('/game-state', (req, res) => {
    if(!gameStarted){
        return res.status(400).json({error: 'Game has not started. Please start a game by entering valid ticker symbol.'});
    }else{
        res.json(gameState);
    }
});

// Reset game route
gameRoutes.post('/reset-game', (req, res) => {
    if (gameStarted) {
        console.warn('Resetting game while a session is active.');
    };

    gameStarted = false;
    gameState = {
        ticker: "",
        startDate: "",
        currentDayIndex: 0,
        prices: [],
        bank: 10000,
        shares: 0,
        history: [],
    };
    res.json({message: 'Game has been reset.', gameState});
});

// Return summary of current game state
gameRoutes.get('/summary', (req, res) => {
    if (!gameStarted) {
        return res.status(400).json({ error: 'No active game.' });
    }
    const currentPrice = gameState.prices[gameState.currentDayIndex].finalPrice;
    const portfolioValue = gameState.bank + (gameState.shares * currentPrice);
    const profitLoss = parseFloat((portfolioValue - 10000).toFixed(2));

    res.json({
        ticker: gameState.ticker,
        currentDay: gameState.currentDayIndex + 1,
        bank: gameState.bank,
        shares: gameState.shares,
        portfolioValue,
        profitLoss,
    });
});


module.exports = gameRoutes;