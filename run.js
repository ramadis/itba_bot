"use strict"; 
const request = require('request-promise');
const express = require('express');
const cheerio = require('cheerio');
const _ = require('lodash');
const diacritics = require('diacritics');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

// Clases is a Collection for the clases.
class Clases {
  constructor (clases) {
    this.clases = clases || Clases.getFromURI();
    const intervalRequest = setInterval(() => getFromURI(), 5 * 60 * 1000);
  }

  where (searchQuery) {
    return searchQuery && this.clases.filter((clase) => clase.is(diacritics.remove(searchQuery)));
  };

  static getFromURI (URI) {
    URI = URI || process.env.DATA_SOURCE;

    const clases = [];
    request(URI).then((html) => {
      // Maps html structure. Represents column number.
      const mapValues = {
        name: 3,
        startTime: 5,
        endTime: 6,
        classroom: 7
      };

      // Remove cheerio wrapper
      const $ = cheerio.load(html);
      const names = unwrappCell(mapValues.name, $);
      const startTime = unwrappCell(mapValues.startTime, $);
      const endTime = unwrappCell(mapValues.endTime, $);
      const classroom = unwrappCell(mapValues.classroom, $);

      // Generate classes array.
      for (let i = 1; i < names.length; i++) {
        if (classroom[i]) clases.push(new Clase(names[i], startTime[i], endTime[i], classroom[i]));
      }
    });

    return this.clases = clases;
  }
}

// Bot wrapper class to interact with Telegram's bot api.
class Bot {
  static get token () { return process.env.TELEGRAM_TOKEN }
  
  constructor () {
    this.bot = new TelegramBot(Bot.token, {polling: true});
  }

  static manageEntry (entry, user) {
    if (!entry) return 'No puedo ayudarte con eso, che.';
    
    const responses = {
      '\/start': '¡Que empiece la fiesta! Mandame el nombre de la materia de la cual querés saber el aula',
      '\/': 'No pa, solo nombres de materias. Nada de esas / medio raras que usan otros bots',
      'puto|gil|trolo|conchudo|salame|puta': 'Tu vieja no piensa lo mismo.'
    }

    return responses[_.keys(responses).find((key) => entry.match(new RegExp(key)))];
  }

  listen (clases) {
    this.bot.on('text', (msg) => {
      msg.text = msg.text.toLowerCase();
      const response = Bot.manageEntry(msg.text, msg.from) || clases.where(msg.text).join('\n') || Bot.manageEntry();
      this.bot.sendMessage(msg.from.id, response);
    });    
  }
}

// Clase class represent a given class.
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

  is (name) { return this.name.includes(name) && this; }

  toString () {
    return `${this.name} empieza a las ${this.startTime} en el aula ${this.classroom}`;
  }
}

// Strips data from cheerio wrapper
const unwrappCell = (cellIdx, $) => {
  return $('table > tbody > tr').find(`td:nth-child(${cellIdx})`)
                                .filter((idx, el) => el.children.length)
                                .map((idx, el) => el.children[0].data.toLowerCase()) || [];
};


app.listen(process.env.PORT || 3000, () => null);
app.get('/', (req, res) => res.send("Download bot from https://storebot.me/bot/itba_bot"));

// Program execution
(() => new Bot().listen(new Clases()))();