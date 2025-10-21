const getRandomDate = () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const additionalDays = Math.floor(Math.random() * 365);
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - additionalDays);
    const startDate = sixMonthsAgo.toISOString().split('T')[0];
    const endDate =  new Date(sixMonthsAgo);
    endDate.setDate(endDate.getDate() + 14);
    return { startDate, endDate: endDate.toISOString().split('T')[0] };
}
module.exports = { getRandomDate };