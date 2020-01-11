#!/usr/bin/env node

let port = 3000;

if (process.env.NODE_ENV === "draft") {
  port = 3003;
}

console.log(port);
