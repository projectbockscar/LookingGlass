const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const moment = require("moment");
const { get, set } = require("./store");

let { ICAO } = require("./ICAO");
ICAO = ICAO.airports;
app.use("*", cors(), async (req, res, next) => {
  console.log("login and user functions");
  req.user = {
    authorized: true,
  };
  next();
});
let icao_breakout;
ICAO.forEach((element) => {
  icao_breakout = {
    ...icao_breakout,
    [element.icao]: element,
  };
});
// console.log(icao_breakout);

app.get("/dispatch", async (req, res, next) => {
  try {
    let flight_data = await get("all_flights");
    let crew_data = await get("all_crew");

    if (!crew_data) {
      console.log("cache CREW MISS");
      const response = await axios(process.env.CREW, {
        headers: {
          "x-api-key": process.env.DISPATCH_KEY,
          Accept: "application/json",
        },
      });
      crew_data = {};
      response.data.forEach((member) => {
        crew_data = {
          ...crew_data,
          [member.username]: member,
        };
      });
      await set("all_crew", JSON.stringify(crew_data), "EX", 600);
    } else {
      console.log("cache CREW HIT");
      crew_data = JSON.parse(crew_data);
    }

    if (!flight_data) {
      console.log("cache MISS");
      flight_data = await axios.get(process.env.DISPATCH, {
        params: {
          fromDate: moment().utc().format(),
          toDate: moment().add(5, "days").utc().format(),
        },
        headers: {
          "x-api-key": process.env.DISPATCH_KEY,
          Accept: "application/json",
        },
      });
      // console.log(flight_data.data.flights);
      const missing = new Set();
      // console.time("missing_checks");
      // for (let i = 0; i < ICAO.length; i++) {
      //   for (let n = 0; n < flight_data.data.flights.length; n++) {
      //     if (flight_data.data.flights[n].departure === ICAO[i].icao) {
      //       flight_data.data.flights[n].departureInfo = ICAO[i];
      //     } else {
      //       missing.add(flight_data.data.flights[n].departure);
      //     }
      //     if (flight_data.data.flights[n].destination === ICAO[i].icao) {
      //       flight_data.data.flights[n].destinationInfo = ICAO[i];
      //     } else {
      //       missing.add(flight_data.data.flights[n].destination);
      //     }
      //   }
      // }
      // console.timeEnd("missing_checks");

      console.time("missing_checks2");
      for (let n = 0; n < flight_data.data.flights.length; n++) {
        if (Boolean(icao_breakout[flight_data.data.flights[n].departure])) {
          flight_data.data.flights[n].departureInfo =
            icao_breakout[flight_data.data.flights[n].departure];
        } else {
          missing.add(flight_data.data.flights[n].departure);
        }
        if (Boolean(icao_breakout[flight_data.data.flights[n].destination])) {
          flight_data.data.flights[n].destinationInfo =
            icao_breakout[flight_data.data.flights[n].destination];
        } else {
          missing.add(flight_data.data.flights[n].destination);
        }
      }
      console.timeEnd("missing_checks2");

      // console.log(flight_data.data.flights.length);
      console.log("missing", missing);
      console.time("missing_checks3");
      flight_data.data.flights.forEach((flight) => {
        for (let i = 0; i < flight.crew.length; i++) {
          if (crew_data[flight.crew[i].crewId]) {
            flight.crew[i].fullname = crew_data[flight.crew[i].crewId].fullname;
          }
        }
      });
      console.timeEnd("missing_checks3");

      flight_data = await JSON.stringify({ flights: flight_data.data.flights });
      await set("all_flights", flight_data, "EX", 10);
    } else {
      console.log("cache HIT");
    }
    flight_data = await JSON.parse(flight_data);

    res.status(200).json({ flights: flight_data.flights });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: error.message });
  }
});

app.get("*", (req, res) => {
  res.status(200).sendFile(path.join(__dirname, "build", req.url));
});

app.use("*", (req, res, next) => {
  if (req.user && req.user.authorized) {
    next();
  } else {
    res.status(403).json({ message: "User Unauthorized" });
  }
});

app.listen(process.env.PORT);
