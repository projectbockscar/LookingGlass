const client = require('redis').createClient();
const { promisify } = require("util");

client.on('connect', () => {
    console.log('Redis client connected');
});

client.on("error", (error) => {
    console.error(error);
});

const get = promisify(client.get).bind(client);
const set = promisify(client.set).bind(client);
const getList = promisify(client.lrange).bind(client);



module.exports = {
    get,
    set,
    getList
};