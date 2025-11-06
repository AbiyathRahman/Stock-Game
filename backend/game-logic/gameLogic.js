const getRandomDate = () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const additionalDays = Math.floor(Math.random() * 365);
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - additionalDays);

    const startDate = sixMonthsAgo.toISOString().split('T')[0];

    const endDate =  new Date();
    endDate.setDate(endDate.getDate() - 1);

    return { startDate, endDate: endDate.toISOString().split('T')[0] };
}
module.exports = { getRandomDate };