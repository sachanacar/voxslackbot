var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var request = require('request');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


//When ready for production change to api.voxbone.com
var url = 'https://sandbox.voxbone.com/ws-voxbone/services/rest/';
var headers = {'Accept': 'application/json','Content-type': 'application/json'};

//Add your own credentials!
var auth = {'user': 'voxtestsacha', 'pass': 'nxyppC2h!'}


/**
 **  Part 1
 **  Order DIDs
 **/

app.post('/', function(req, res){
	
//Launch requests!
// /did USA, NEW YORK, GEOGRAPHIC, voxsms, 1
if (req.body.token == 'your_slack_channel_token'){
	//Get the incoming string of text from Slack
	var string = req.body.text;
	//Split the string into parameters separated by a comma and a space
	var parameters = string.split(', ');
	//Assign each variable to its respective Slack text parameter
	var country = parameters[0];
	var city = parameters[1];
	var type = parameters[2];
	var feature = parameters[3];
	var quantity = parameters[4];
	//We will also use the response_url for reasons to be developed on later!
	var response_url = req.body.response_url;
	//On success, launch a series of callback functions that will use these parameters to interact with the VoxAPI
	searchDid(0,1,country, city, type, feature, quantity, response_url);
} else{
	//If the token is not present, return some kind of message
	res.status(200).send('You are not authorized to reach this endpoint!');
}

//Search DID
function searchDid(pageNumber, pageSize, countryCodeA3, cityNamePattern, didType, featureIds, quantity, response_url){
	//First we translate the specified voxsms or voxfax parameter into a proper feature ID which the VoxAPI uses, respectively 25 and 6
	var fid = getFeatureId(featureIds);
	function getFeatureId(featureIds){
		if (featureIds = null){
			fid = NULL;
		} else if (featureIds = 'voxsms'){
			fid = 25;
		} else if (featureIds = 'voxfax'){
			fid = 6;
		}
		return fid;
	};
	//Now we set up the options that will be sent in the request using the URL declared previously, your auth information, and adding the query parameters to the URL
	var options = {
		url: url+'inventory/didgroup',
		headers: headers,
		"auth": auth,
		qs : {
	        "pageNumber" : pageNumber,
	        "pageSize" : pageSize,
	        "countryCodeA3" : countryCodeA3,
	        //the % sign is used in VoxAPI to specify the pattern to be searched, New Yo would work just as well as New York thanks to this
	        "cityNamePattern": cityNamePattern+'%',
	        "didType": didType,
	        "featureIds": fid
    	} 
	};
	//Now we can launch the actual search request to the VoxAPI
	request.get(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var body = JSON.parse(body);
            //We recover the DIDGroupID of the first DID returned by the API to use it later when adding to the cart.
            var didid = body.didGroups[0].didGroupId;
            console.log('[DEBUG] - DID found: '+didid);
            //As per the proper flow of ordering DIDs, we will create a new cart and pass the didGroupId, quantity, and response_url to the callback function for later use
            createCart(didid, quantity, response_url);
        } else {
        	var body = JSON.parse(body);
        	// In case the request is unsuccessful, we return the error message coming from the VoxAPI to the Slack Channel
        	res.setHeader('Content-Type', 'application/json');
			res.status(200).send('could not find DID matching those criteria! '+ body.errors[0].apiErrorMessage);
        }
    });
}

// Create Cart
function createCart(didid, quantity, response_url){
	//Here we set a random customer reference number
	var cr = Math.floor((Math.random() * 100) + 1);
	var description = "cart #: " + cr;
	var options = {
		url: url+'ordering/cart',
		headers: headers,
		"auth": auth,
		body: JSON.stringify({ customerReference : cr, description : description }) 
	};
	//Here’s the actual request to create the cart
	request.put(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
        	var body = JSON.parse(body);
        	//We retrieve the cart identifier number from the VoxAPI to use in the addToCart() method
            var cartId = body.cart.cartIdentifier;
        	console.log('[DEBUG] - Cart Created: #'+cartId);
        	//This is the callback function to add the DID we just found to the cart we just created, with a specified quantity. We also pass the response_url (more on that later)
            addToCart(didid, quantity, cartId, response_url);
        } else {
        	//If something goes wrong, we send back to the Slack Channel a notification
        	res.setHeader('Content-Type', 'application/json');
			res.status(200).send('could not create cart!');
        }
    });
}

//Add to Cart
//We pass the DIDGroupId of the DID we searched for, the cartID of the cart we created, and the quantity (how many of those DIDs we’ll purchase.
function addToCart(didid, quantity, cartId, response_url){
	var options = {
		url: url+'ordering/cart/'+cartId+'/product',
		headers: headers,
		"auth": auth,
		body: JSON.stringify({ didCartItem : {didGroupId : didid, quantity : quantity}}) 
	};
	request.post(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log('[DEBUG] - '+quantity+' DIDs of didGroup #'+didid+' added to Cart #'+ cartId);
            //Checking out the cart is the next logical step, for this we only need the cart ID which is filled with the DIDs we wish to purchase. We also pass the response_url (I promise I’ll get to that before the end!)
            checkoutCart(cartId, response_url);
        } else {
        	//If something goes wrong, we send back to the Slack Channel a notification
        	res.setHeader('Content-Type', 'application/json');
			res.status(200).send('could not add to cart!');
        }
    });
}

//Checkout Cart
function checkoutCart(cartId, response_url){
	var options = {
		url: url+'ordering/cart/'+cartId+'/checkout',
		headers: headers,
		"auth": auth,
		qs : {
	        "cartIdentifier" : cartId
    	} 
	};
	request.get(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
        	var body = JSON.parse(body);
        	//Here’s a warning handler in case something goes wrong, it detects whether the status return from VoxAPI is ‘WARNING’
            if (body.status == 'WARNING'){
            	var message = body.productCheckoutList[0].message;
				sendResponse(message, response_url);
				res.setHeader('Content-Type', 'application/json');
				res.status(200).send('There was a problem ordering your DID.');
            } else{
            	//If there are no problem, every thing is fine - the DID will be purchased, and we send back an order reference
        		console.log("Your DID has been purchase and your order reference # is: "+body.productCheckoutList[0].orderReference);
        		var message = "Your DID has been purchase and your order reference # is: "+body.productCheckoutList[0].orderReference;
        		res.setHeader('Content-Type', 'application/json');
				res.status(200).send('DID order! Confirmation on its way.');
	        	//Here’s where it gets interesting - more on it below!
	        	sendResponse(message, response_url);

            };
        } else {
        	res.setHeader('Content-Type', 'application/json');
			res.status(200).send('could not checkout cart!');
        }
    });
}

function sendResponse(message, response_url){
	var options = {
		url: response_url,
		headers: headers,
		body: JSON.stringify({ text : message }) 
	};
	//Here we are actually making a post request to the Slack response_url instead of the VoxAPI endpoints and we pass back the message that we created in the previous section.
	request.post(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
        	console.log(response);
        } else {
        	console.log(response);
        }
    });
}
});

/**
 **  Part 2
 **  Configure DIDs
 **/
 //curl localhost:3000/list -d {text="BEL, 660", response_url="localhost:3000"

//List DIDs
app.post('/list', function(req, res){
	if (req.body.token == '5MJZXfPJGsc1x9Rv9UpIyaUh'){
	    //Get the incoming string of text from Slack
	    var string = req.body.text;

	    //Split the string into parameters separated by a comma and a space
	    var parameters = string.split(', ');

	    //Assign each variable to its respective Slack text parameter
	    var country = parameters[0];
	    var e164Pattern = parameters[1];

	    //We will also use the response_url for reasons to be developed on later (but you are now familiar with!)    
	    var response_url = req.body.response_url;

	    //On success, launch a series of callback functions that will use these parameters to interact with the VoxAPI
	    listDids(0,5000,country,e164Pattern, response_url);
	} else{
	    //If the token is not present, return some kind of message
	    res.status(200).send('You are not authorized to reach this endpoint!');
	}
	function listDids(pageNumber, pageSize, country, e164Pattern, response_url){
		//Now we set up the options that will be sent in the request using the URL declared previously, your auth information, and adding the query parameters to the URL
		var options = {
			url: url+'inventory/did',
			headers: headers,
			"auth": auth,
			qs : {
		        "pageNumber" : pageNumber,
		        "pageSize" : pageSize,
		        "countryCodeA3" : country,
		        //the % sign is used in VoxAPI to specify the pattern to be searched. It indicates that the value passed is part of a larger string.
		        "e164Pattern": '%'+e164Pattern+'%',
	    	} 
		};
		request.get(options, function (error, response, body) {
	        if (!error && response.statusCode == 200) {
	        	var body = JSON.parse(body);
	        	console.log(body);
	        	var dids = body.dids;
	        	//For each DID in your inventory matching those parameters, we formulate a message to spit back to Slack
	        	for (i=0; i<dids.length; i++) {
	        		var didId = dids[i].didId;
	        		var e164 = dids[i].e164;
	        		var type = dids[i].type;
	        		var country = dids[i].countryCodeA3;
	        		var city = dids[i].cityName;
	        		var webrtc = dids[i].webRtc;
	        		var uriId = dids[i].voiceUriId;
	        		var number = i+1;
	        		//This message is incomplete because it is missing the actual URI - which we retrieve in getUri()
	        		var message_incomplete = '\n'+'number: '+e164+' | id: '+didId+' | type: '+type+' | country: '+country+' | city: '+city+' | webrtc: '+ webrtc;
					getUri(message_incomplete, uriId, response_url);
					console.log('[DEBUG] - DIDs found: #'+dids[i].didId+' uriId: '+ uriId);
	        	}
	        } else {
	        	//If something goes wrong, we send back to the Slack Channel a notification
	        	var message_complete = 'Could not find DIDs!';
			    sendResponse(message_complete, response_url);
	        }
	    });
	}

	//Get Voice URI
	function getUri(message_incomplete, uriId, response_url){
		var options = {
			url: url+'configuration/voiceuri',
			headers: headers,
			"auth": auth,
			qs : {
		        "pageNumber" : 0,
		        "pageSize" : 1,
		        "voiceUriId": uriId,
	    	} 
		};
		request.get(options, function (error, response, body) {
	        if (!error && response.statusCode == 200) {
	        	var body = JSON.parse(body);
	        	var uri = body.voiceUris[0].uri;
	        	//We concatenate the incomplete message from listDids with the URI we retrieved using each DID's URI ID.
	        	var message_complete = message_incomplete+' | uri: '+uri;
				console.log('[DEBUG] - URI found! ID: '+uriId+ 'URI: '+uri);
				//We can now send the response to slack with the complete comfirmation message!
				sendResponse(message_complete, response_url);
	        } else {
	        	//If something goes wrong, we send back to the Slack Channel a notification
	        	var message_complete = 'Could not find URI!';
			    sendResponse(message_complete, response_url);
	        }
	    });
	};
	function sendResponse(message_complete, response_url){
		var options = {
			url: response_url,
			headers: headers,
			body: JSON.stringify({ text : message_complete }) 
		};
		//Here we send back the complete message to the Slack Channel.
		request.post(options, function (error, response, body) {
	        if (!error && response.statusCode == 200) {
	        	console.log(body);
	        } else {
	        	console.log(body);
	        }
	    });
	}
});


//Configure DIDs
// curl localhost:3000/configure -d text="3225887655, sachanacar@getonsip.com, true"
// /configure 3225887655, sachanacar@getit.com, true
// /list BEL, 3225887655
app.post('/configure', function(req, res){
	if (req.body.token == 'VDRRVoF0kZnHCjpZHo2JzFGg'){
		//Get the incoming string of text from Slack
		var string = req.body.text;
		//Split the string into parameters separated by a comma and a space
		var parameters = string.split(', ');
		//Assign each variable to its respective Slack text parameter
		var number = parameters[0];
		var uri = parameters[1];
		var webrtc = parameters[2];
		//We will also use the response_url for reasons to be developed on later (but you are now familiar with!)    
		var response_url = req.body.response_url;
		//On success, launch a series of callback functions that will use these parameters to interact with the VoxAPI
		checkUri(0, 1, number, uri, webrtc, response_url);
	} else{
		//If the token is not present, return some kind of message
		res.status(200).send('You are not authorized to reach this endpoint!');
	}

	//Check the URI passed to see if it exists
	function checkUri(pageNumber, pageSize, number, uri, webrtc, response_url){
		var options = {
			url: url+'configuration/voiceuri',
			headers: headers,
			"auth": auth,
			qs : {
		        "pageNumber" : pageNumber,
		        "pageSize" : pageSize,
		        "uri" : uri
	    	} 
		};
		request.get(options, function (error, response, body) {
	        if (!error && response.statusCode == 200) {
	        	var body = JSON.parse(body);
	        	var voiceUri = body.voiceUris[0];
	        	//Check whether the returned list of voice URIs specified from Slack is null or !null
	        	if (voiceUri != null) {
	        		//!null -> URI exists -> link URI
	        		var uriId = voiceUri.voiceUriId;
					console.log('[DEBUG] - URI exists -> Linking URI...');
					//We retrieve the DID ID based on the e164 number
	        		getDid(0, 1, number, uri, webrtc, uriId, response_url);
	        	}else{
	        		//null -> URI does not exist -> Create URI
					console.log('[DEBUG] - URI does not exist -> Creating URI...');
					//We create the URI
					createUri(number, uri, webrtc, uriId, response_url);
	        	}
	        } else {
				var message = 'Error while trying to find URI';
				sendResponse(message, response_url);

	        }
	    });
	}
	//Create URI
	function createUri(number, uri, webrtc, uriId, response_url){
		var options = {
			url: url+'configuration/voiceuri',
			headers: headers,
			"auth": auth,
			body: JSON.stringify({ voiceUri : {voiceUriProtocol: "SIP", uri: uri, description: "uri for "+number}}) 
		};
		request.put(options, function (error, response, body) {
	        if (!error && response.statusCode == 200) {
	        	console.log('[DEBUG] - URI Created -> Linking URI');
	        	var body = JSON.parse(body);
	        	//We retrieve the URI ID from the newly created URI
	        	var newUriId = body.voiceUri.voiceUriId;
	        	//We retrieve the DID ID based on the e164 number
	        	getDid(0, 1, number, uri, webrtc, newUriId, response_url);
	        } else {
	        	console.log('[DEBUG] - Creating URI unsuccessful!');
	        	var message = 'Error creating URI!';
	        	//If something goes wrong, we send back an error message to the Slack Channel.
	        	sendResponse(message, response_url);
	        }
	    });
	}
	//Get DID ID information to use in linkUri
	function getDid(pageNumber, pageSize, number, uri, webrtc, uriId, response_url){
		var options = {
			url: url+'inventory/did',
			headers: headers,
			"auth": auth,
			qs : {
		        "pageNumber" : pageNumber,
		        "pageSize" : pageSize,
		        "e164Pattern" : '%'+number+'%'
	    	} 
		};
		request.get(options, function (error, response, body) {
	        if (!error && response.statusCode == 200) {
	        	var body = JSON.parse(body);
	        	var didId = body.dids[0].didId;
	        	console.log('[DEBUG] - DID ID found -> Linking URI...');
	        	//Now that we've retrieved the DID ID, we can link the URI ID to the DID ID.
	        	linkUri(number, uri, webrtc, uriId, didId, response_url);
	        } else {
	        	console.log('[DEBUG] - DID ID not found -> aborting...');
	        	//If something goes wrong, we send back an error message to the Slack Channel.
				var message = 'Could not find DID!';
				sendResponse(message, response_url);
	        }
	    });
	}
	
	//Link URI to DID
	function linkUri(number, uri, webrtc, uriId, didId, response_url){
		var options = {
			url: url+'configuration/configuration',
			headers: headers,
			"auth": auth,
			body: JSON.stringify({ didIds : [ didId ],voiceUriId: uriId, webRtcEnabled: webrtc}) 
		};
		request.post(options, function (error, response, body) {
	        if (!error && response.statusCode == 200) {
	        	console.log('[DEBUG] - Linking successful!');
	        	console.log(body);
	        	var message = 'URI: '+ uri + ' has been linked to '+ number+ ' and webRTC functionality set to '+ webrtc;
	        	//Once we have a successful link, we send back a confirmation to the Slack channel.
				sendResponse(message, response_url);
	        } else {
	        	console.log('[DEBUG] - Linking unsuccessful!');
	        	var message = 'Error linking URI!';
	        	//If something goes wrong, we send back an error message to the Slack Channel.
	        	sendResponse(message, response_url);
	        }
	    });
	}
	function sendResponse(message, response_url){
		var options = {
			url: response_url,
			headers: headers,
			body: JSON.stringify({ text : message }) 
		};
		request.post(options, function (error, response, body) {
	        if (!error && response.statusCode == 200) {
	        	console.log(response);
	        } else {
	        	console.log(response);
	        }
	    });
	}

});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});


module.exports = app;
