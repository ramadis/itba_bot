"use strict"; 
const request = require('request-promise');
const express = require('express');
const cheerio = require('cheerio');
const _ = require('lodash');
const diacritics = require('diacritics');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

class Bot {
  static get token () { return process.env.TELEGRAM_TOKEN }
  
  constructor () {
    this.bot = new TelegramBot(Bot.token, {polling: true});
  }

  static manageEntry (entry, user) {
    if (!entry) return 'No puedo ayudarte con eso, che.';

    if (entry.match(/\/start/)) return `¡Que empiece la fiesta! Mandame el nombre de la materia de la cual querés saber el aula`;
    if (entry.match(/\//)) return 'No pa, solo nombres de materias. Nada de esas / medio raras que usan otros bots';
    if (entry.match(/(puto | gil | trolo | conchudo | salame | puta | conchudo)/)) return 'Tu vieja no piensa lo mismo.';

    return;
  }

  listen () {
    this.bot.on('text', (msg) => {
      const response = Bot.manageEntry(msg.text, msg.from) || searchRequest(msg.text.toLowerCase()) || Bot.manageEntry();
      this.bot.sendMessage(msg.from.id, response);
    });    
  }
}

const fail = (err) => console.error(err);

let clasesArr = [];
let htmlComplete = {};
const unwrappCell = (cellIdx) => {
  const arr = [];
  const $ = cheerio.load(htmlComplete);
  const arrWrapped = $('table > tbody > tr').find(`td:nth-child(${cellIdx})`).each((idx, el) => {
    if (el.children.length) arr.push(el.children[0].data.toLowerCase());
  });

  return arr;
};

class Clase {
  constructor (name, startTime, endTime, classroom) {
    this.name = name;
    this.startTime = startTime;
    this.endTime = endTime;
    this.classroom = classroom;
  }

  get name () { return _.capitalize(this._name); }
  set name (name) {
    this._name = diacritics.remove(name.toLowerCase());
  }

  is (name) {
    if (this.name.includes(name)) return this;
    return null;
  }

  toString () {
    return `${this.name} empieza a las ${this.startTime} en el aula ${this.classroom}`;
  }
}

const searchRequest = (searchQuery) => {
  if (!searchQuery) return;
  let response = '';

  clasesArr.forEach((clase) => {
    if (clase.is(diacritics.remove(searchQuery))) response += clase + '\n';
  });

  return response;
};

const processRequest = (html) => {
  htmlComplete = html;

  // Maps html structure. Represents column number.
  const mapValues = {
    name: 3,
    startTime: 5,
    endTime: 6,
    classroom: 7
  };

  // Remove cheerio wrapper
  const names = unwrappCell(mapValues.name);
  const startTime = unwrappCell(mapValues.startTime);
  const endTime = unwrappCell(mapValues.endTime);
  const classroom = unwrappCell(mapValues.classroom);

  // Generate classes array.
  const clases = [];
  for (let i = 1; i < names.length; i++) {
    if (classroom[i]) {
      clases.push(new Clase(names[i], startTime[i], endTime[i], classroom[i]));
    }
  }

  clasesArr = clases;
};

const makeRequest = () => {
  const url = process.env.DATA_SOURCE;
  request(url).then(processRequest).catch(fail);
};

app.listen(process.env.PORT || 3000, () => null);
app.get('/', (req, res) => res.send("hola"));
(() => {
  const bot = new Bot();
  bot.listen();
  makeRequest();
  const intervalRequest = setInterval(() => makeRequest(), 5 * 60 * 1000);
})();