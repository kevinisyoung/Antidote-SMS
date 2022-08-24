const restClient = process.env['restClient'];
const signalwireUrl = process.env['signalwireUrl'];




const { RelayConsumer } = require('@signalwire/node')
const client = new RestClient(restClient, { signalwireSpaceUrl: 'antidote.signalwire.com' })
// const mySecret = process.env['restClient']



var express = require("express");
var fs = require("fs");
var ddg = require('ddg');
var weather = require('weather-js');
var app = express();
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });
const TEST_MODE = false;
const AXIOS = require('axios');
let database = JSON.parse(fs.readFileSync("database.json"));
const GOOGLE_MAPS_CLIENT = require("@google/maps").createClient({
	key: googleMapsKey
});
const server = app.listen(3000, () => {
	console.log("Server running on port 3000");
});
app.get("/", (req, res, next) => {
	res.set('Content-Type', 'text/xml');
	res.send('<Response><Hangup/></Response>');
});
app.post("/", urlencodedParser, function(req, res) {
	var messageRecieved = req.body.Body;
	var numberIncoming = req.body.From;
	var signalWireNumber = req.body.To;
	messageRecieved = messageRecieved.replace(/[^\x20-\x7E]/g, '');
	console.log("Null char location" + messageRecieved.indexOf('\0'));
	var tempMessageRecieved = messageRecieved.replace(" ", "").toLowerCase();
	console.log(tempMessageRecieved);
	var messageResponse = "Sorry, no command found.";
	var readyToSend = true;
	var isFirstMessage = false;
	var profileIndex = searchDatabase();
	var costForMessage = 0;
	console.log(
		"Incoming message from: " +
		numberIncoming +
		"\n" +
		"'" +
		messageRecieved +
		"'"
	);

	if (profileIndex == -1) {
		console.log("Hello this profile does not exist yet lets create it");
		isFirstMessage = true;
		sendTrialMessage();
		createUserProfile();
	}
	if (database[profileIndex].balance > 0) {
		processMessage(req);
	}
	else if (database[profileIndex].balance !== - 99) {
		sendEmptyBalMessage();
		database[profileIndex].balance = -99;
	}
	function processMessage(req) {


		if (tempMessageRecieved == "stopserver") {
			console.log("I think we're stopping...");
			readyToSend = false;
			server.close(() => {
				console.log('Closed out remaining connections');
				process.exit(0);
			});
		}
		if (tempMessageRecieved.includes("directions")) {
			//wait to send the message until the directions have been proccessed
			readyToSend = false;
			//set tempMessageRecieved to an array of words from the user's body
			tempMessageRecieved = messageRecieved.split(" ");
			//search thru each word to find out where da origin and dest are
			var startOfOrigin,
				endOfOrigin,
				startOfDest,
				endOfDest = tempMessageRecieved.length;
			var userOrigin = "",
				userDest = "";
			for (var i = 0; i < tempMessageRecieved.length; i++) {
				if (tempMessageRecieved[i].toLowerCase() == ("from")) {
					startOfOrigin = i + 1;
				} else if (tempMessageRecieved[i].toLowerCase() == ("to")) {
					endOfOrigin = i;
					startOfDest = i + 1;
				} else if (
					tempMessageRecieved[i].toLowerCase().includes("please") ||
					tempMessageRecieved[i].toLowerCase().includes("plz") ||
					tempMessageRecieved[i].toLowerCase().includes("pls")
				) {
					endOfDest = i;
				}
			}
			for (var i = startOfOrigin; i < endOfOrigin; i++) {
				userOrigin += tempMessageRecieved[i] + " ";
			}
			for (var i = startOfDest; i < endOfDest; i++) {
				userDest += tempMessageRecieved[i] + " ";
			}

			console.log("User Origin: " + userOrigin);
			console.log("User Dest: " + userDest);
			//makes sure the correct origin and dest are being calculated
			//first gets the origin's lat/long to calculate nearest destination
			calculateOriginPlaceInfo(userOrigin, userDest);
		}

		else if ((tempMessageRecieved === "hi" || tempMessageRecieved === "hello" || tempMessageRecieved === "yo" || tempMessageRecieved === "sup" || tempMessageRecieved === "hey") && isFirstMessage == false) {
			var currBalance = database[profileIndex].balance;
			var currAlotment = database[profileIndex].monthlyAlotment;
			var remaining = (currAlotment - currBalance / currAlotment);
			messageResponse = "Hello! You have " + currBalance + " responses left. We won't reply to basic greetings in the future in an effort to keep your usage down.";
			console.log("vish");
			console.log(messageResponse);
		} else if (tempMessageRecieved == ("help")) {
			messageResponse = fs.readFileSync("commands.txt");
			readyToSend = true;
			sendMessage();
		}
		else if (tempMessageRecieved.includes("search")) {
			readyToSend = false;
			tempMessageRecieved = tempMessageRecieved.replace("search", "");
			console.log(tempMessageRecieved);
			ddg.query(tempMessageRecieved, function(err, data) {
				console.log(data);
				//found some info from DDG
				if (data.AbstractText != '') {
					readyToSend = true;
					messageResponse = data.AbstractText;
					costPerSegment = 0.005;
				}
				//try wikipedia
				else {
					messageResponse = "Sorry, no results found for " + tempMessageRecieved;
					readyToSend = true;
				}
				sendMessage();
				// console.log(data) // logs a dictionary with all return fields
			});
		} else if (tempMessageRecieved == "bal" || tempMessageRecieved == "balance") {
			messageResponse = "Messages remaining: " + database[profileIndex].balance + '\n' + "Next cycle: " + database[profileIndex].nextRefill;
		}
		else if (tempMessageRecieved.includes("weather")) {
			readyToSend = false;
			//set tempMessageRecieved to an array of words from the user's body
			tempMessageRecieved = tempMessageRecieved.replace("weather ", "");
			var location = tempMessageRecieved;
			weather.find({ search: location, degreeType: 'F' }, function(err, result) {
				if (err) console.log(err);
				formatWeather(result);
				// console.log(JSON.stringify(result, null, 2));
			});
		}
		else if (isFirstMessage) {
			readyToSend = false;
		}

		if (readyToSend) {
			sendMessage();
		}

	}

	//Maps implementation
	function getMapsData(userOrigin, originName, userDest, destName) {

		GOOGLE_MAPS_CLIENT.directions(
			{
				origin: userOrigin,
				destination: userDest
			},
			function(err, response) {
				if (!err) {
					costForMessage = 1;
					// return response;
					messageResponse = originName + " -> " + destName;
					formatMapsData(response.json.routes[0].legs[0]);
				}
			}
		);

	}

	function calculateOriginPlaceInfo(userOrigin, userDestKeyword) {

		GOOGLE_MAPS_CLIENT.findPlace(
			{
				input: userOrigin,
				inputtype: 'textquery',
				fields: [
					'formatted_address', 'geometry', 'id', 'name'
				]
			},
			function(err, response) {
				if (!err) {
					// return response;
					console.log("found the lat long of the origin.  Now passing into findPlace to find the nearest instance of the dest.");
					userOrigin = response.json.candidates[0].name;
					var tempLat = response.json.candidates[0].geometry.location.lat;
					var tempLong = response.json.candidates[0].geometry.location.lng;
					var originAddress = response.json.candidates[0].formatted_address;
					findNearestDest(tempLat, tempLong, userOrigin, originAddress, userDestKeyword);
				}
			}
		);
	}

	function findNearestDest(lat, lng, userOrigin, originAddress, destKeyword) {
		var tmpString = "" + lat + "," + lng;
		console.log("hey");
		GOOGLE_MAPS_CLIENT.findPlace(
			{
				input: destKeyword,
				inputtype: "textquery",
				fields: ['geometry', 'name', 'formatted_address'],
				locationbias: "point:" + tmpString
			},
			function(err, response) {
				if (!err) {
					// return response;
					userDest = response.json.candidates[0].name;
					var tempDestFullAddy = response.json.candidates[0].formatted_address;
					//finally!!! Let's calculate the directions with the correct dest :)
					getMapsData(originAddress, userOrigin, tempDestFullAddy, userDest);
				}
				else {
					console.log(err);
				}
			}
		);
	}

	function formatMapsData(data) {
		messageResponse += '\n' + data.duration.text + ", " + data.distance.text + "\n";
		for (var i = 0; i < data.steps.length; i++) {
			if (i == data.steps.length - 1) {
				var tempPos = data.steps[i].html_instructions.indexOf("Destination");
				var finalStep = data.steps[i].html_instructions.slice(0, tempPos) + "\n" + data.steps[i].html_instructions.slice(tempPos);
				messageResponse += formatDirectionsString(finalStep);
			}
			else {
				messageResponse +=
					i +
					1 +
					" : ";
				if (i > 0) {
					if (data.steps[i - 1].duration.value < 60) {
						messageResponse += data.steps[i - 1].distance.text +
							" - ";
					}
					else {
						messageResponse += data.steps[i - 1].distance.text +
							", " +
							data.steps[i - 1].duration.text +
							" - ";
					}
				}
				messageResponse +=
					formatDirectionsString(data.steps[i].html_instructions) +
					"\n";
			}
		}

		console.log(
			"Response proccessed, ready to send to user.\n" + messageResponse
		);
		readyToSend = true;
		sendMessage();
	}

	function formatDirectionsString(string) {
		string = string.replace(/<[^>]*>/g, "");
		string = string.replace("&nbsp;", "");

		return string;
	}

	function formatWeather(data) {
		console.log(data);
		if (data == "") {
			messageResponse = "Invalid location.";
		} else {


			var location = data[0].location.name;
			var temp = data[0].current.temperature;
			var sky = data[0].current.skytext;
			var wind = data[0].current.windspeed;
			messageResponse = `${location} curr. ${temp}F, ${sky}, ${wind} wind`;
			for (var i = 1; i < 5; i++) {
				var day = data[0].forecast[i].shortday;
				var h = data[0].forecast[i].high;
				var l = data[0].forecast[i].low;
				sky = data[0].forecast[i].skytextday;
				messageResponse += `\n${day} - H:${h} L:${l} ${sky}`;
			}
		}
		readyToSend = true;
		sendMessage();
	}


	function sendMessage() {
		console.log("Response POST  Params --->" + JSON.stringify(req.body));

		//respond to user
		if (readyToSend) {
			if (TEST_MODE) {
				console.log("TEST MODE, MESSAGE NOT SENT TO USER.");
			}
			else {
				res.send("<Response><Message>" + messageResponse + "</Message></Response>");
			}
			console.log("Message sent to " + req.body.From + ": " + messageResponse);
			updateUserBalance();
			res.end();
		}
	}

	function sendTrialMessage() {
		var trialMessage = "Welcome to Antidote SMS!  Feel free to try us out.  Your account has been loaded with 5 free valid responses.  Say \"Help\" to see what I can do.";

		client.messages
			.create({ from: signalWireNumber, body: trialMessage, to: numberIncoming })
			.then(message => console.log(message.sid))
			.done();
		console.log("Message sent to " + req.body.From + ": " + trialMessage);
	}

	function sendEmptyBalMessage() {
		var trialMessage = "Your balance is empty.  Visit ANTDT.tech to select a plan for your account.";

		client.messages
			.create({ from: signalWireNumber, body: trialMessage, to: numberIncoming })
			.then(message => console.log(message.sid))
			.done();
		console.log("Message sent to " + req.body.From + ": " + trialMessage);
	}


	//---------------------------------------Billing functions
	function calculateMessageCost() {
		if (messageResponse.length > 160) {
			segments = 0;
			var tempLength = messageResponse.length;

			while (tempLength > 0) {
				tempLength -= 153;
				segments++;
			}
		}
		console.log("SEGMENTS: " + segments);

	}

	function updateUserBalance() {
		database[profileIndex].balance -= costForMessage;
		updateDatabase();
	}


	//---------------------------------------database functions
	function searchDatabase() {
		//search for the profile with num
		//returns the index in the json
		//returns -1 if not found
		var index = -1;
		for (var i = 0; i < database.length; i++) {
			if (numberIncoming == database[i].phoneNumber) {
				index = i;
			}
		}
		return index;
	}

	function createUserProfile() {
		var nextRefill = new Date(new Date().setDate(new Date().getDate() + 30));
		var dd = String(nextRefill.getDate()).padStart(2, '0');
		var mm = String(nextRefill.getMonth() + 1).padStart(2, '0');
		var refillDate = mm + "/" + dd;
		database.push(
			{
				"id": database.length - 1,
				"phoneNumber": numberIncoming,
				"monthlyAlotment": 0,
				"balance": 5,
				"nextRefill": refillDate,
				"firstName": null,
				"lastName": null
			}
		);
		profileIndex = database.length - 1;
		updateDatabase();
	}

	function updateDatabase() {
		var tempJson = JSON.stringify(database, null, 2);
		fs.writeFileSync("database.json", tempJson);
	}

});