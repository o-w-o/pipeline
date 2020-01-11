#!/usr/bin/env node

const yargs = require("yargs");

const {argv} = yargs.options({
  target: {type: "string", default: "server"},
});

let version;

switch (argv.target) {
  case "server": {
    version = '1.0.1';
    break;
  }
  case "proxy": {
    version = '1.1.1';
    break;
  }
  case "client": {
    version = '1.1.0';
    break;
  }
  default: {
    version = "latest"
  }
}

console.log(version);
