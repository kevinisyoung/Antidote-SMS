var methods = {};

methods.searchDatabase = function(num,database) {
	
	//search for the profile with num
	//returns the index in the json
	//returns -1 if not found
	var index = -1;
	for (var i = 0; i < database.length; i++) {
		if (num == database[i].phoneNumber) {
			index = i;
		}
	}
	return index;
}

methods.sendTrialMessage = function(){
	res.send("<Response><Message>" + "Welcome to Antidote SMS!  Feel free to try us out.  Your account has been loaded with $0.25.  Visit ANTD.io to subscribe." + "</Message></Response>");
	console.log("Message sent to " + req.body.From + ": " + messageResponse);
}

module.exports = methods;