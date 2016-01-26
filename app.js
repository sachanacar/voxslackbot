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
	var string = req.body.text;
	var parameters = string.split(', ');
	var country = parameters[0];
	var city = parameters[1];
	var type = parameters[2];
	var feature = parameters[3];
	var quantity = parameters[4];
	var response_url = req.body.response_url;
	searchDid(0,1,country, city, type, feature, quantity, response_url);
} else{
	res.status(200).send('You are not authorized to reach this endpoint!');
}

//Search DID
function searchDid(pageNumber, pageSize, countryCodeA3, cityNamePattern, didType, featureIds, quantity, response_url){
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
	var options = {
		url: url+'inventory/didgroup',
		headers: headers,
		"auth": auth,
		qs : {
	        "pageNumber" : pageNumber,
	        "pageSize" : pageSize,
	        "countryCodeA3" : countryCodeA3,
	        "cityNamePattern": cityNamePattern+'%',
	        "didType": didType,
	        "featureIds": fid
    	} 
	};
	request.get(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var body = JSON.parse(body);
            var didid = body.didGroups[0].didGroupId;
            console.log('[DEBUG] - DID found: '+didid);
            createCart(didid, quantity, response_url);
        } else {
        	var body = JSON.parse(body);
        	res.setHeader('Content-Type', 'application/json');
			res.status(200).send('could not find DID matching those criteria! '+ body.errors[0].apiErrorMessage);
        }
    });
}

// Create Cart
function createCart(didid, quantity, response_url){
	var cr = Math.floor((Math.random() * 100) + 1);
	var description = "cart #: " + cr;
	var options = {
		url: url+'ordering/cart',
		headers: headers,
		"auth": auth,
		body: JSON.stringify({ customerReference : cr, description : description }) 
	};
	request.put(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
        	var body = JSON.parse(body);
            var cartId = body.cart.cartIdentifier;
        	console.log('[DEBUG] - Cart Created: #'+cartId);
            addToCart(didid, quantity, cartId, response_url);
        } else {
        	res.setHeader('Content-Type', 'application/json');
			res.status(200).send('could not create cart!');
        }
    });
}

//Add to Cart
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
            checkoutCart(cartId, response_url);
        } else {
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
            if (body.status == 'WARNING'){
            	var message = body.productCheckoutList[0].message;
				sendResponse(message, response_url);
				res.setHeader('Content-Type', 'application/json');
				res.status(200).send('There was a problem ordering your DID.');
            } else{
        		console.log("Your DID has been purchase and your order reference # is: "+body.productCheckoutList[0].orderReference);
        		var message = "Your DID has been purchase and your order reference # is: "+body.productCheckoutList[0].orderReference;
        		res.setHeader('Content-Type', 'application/json');
				res.status(200).send('DID order! Confirmation on its way.');
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

app.post('/list', function(req, res){
	if (req.body.token == '5MJZXfPJGsc1x9Rv9UpIyaUh'){
		var string = req.body.text;
		var parameters = string.split(', ');
		var country = parameters[0];
		var e164Pattern = parameters[1];
		var response_url = req.body.response_url;
		listDids(0,5000,country,e164Pattern, response_url);
	} else{
		res.status(200).send('You are not authorized to reach this endpoint!');
	}

	function listDids(pageNumber, pageSize, country, e164Pattern, response_url){
		var options = {
			url: url+'inventory/did',
			headers: headers,
			"auth": auth,
			qs : {
		        "pageNumber" : pageNumber,
		        "pageSize" : pageSize,
		        "countryCodeA3" : country,
		        "e164Pattern": '%'+e164Pattern+'%',
	    	} 
		};
		request.get(options, function (error, response, body) {
	        if (!error && response.statusCode == 200) {
	        	var body = JSON.parse(body);
	        	console.log(body);
	        	var dids = body.dids;
	        	for (i=0; i<dids.length; i++) {
	        		var didId = dids[i].didId;
	        		var e164 = dids[i].e164;
	        		var type = dids[i].type;
	        		var country = dids[i].countryCodeA3;
	        		var city = dids[i].cityName;
	        		var webrtc = dids[i].webRtc;
	        		var uriId = dids[i].voiceUriId;
	        		var uri = 'hi';
	        		var number = i+1;
	        		var message = number+') '+'number: '+e164+' | id: '+didId+' | type: '+type+' | country: '+country+' | city: '+city+' | webrtc: '+ webrtc+' | uri: '+uri;
					sendResponse(message, response_url)
	        	}
	        } else {
	        	console.log(body);
	        	res.setHeader('Content-Type', 'application/json');
				res.status(200).send('could not create cart!');
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
	function getUri(uriId){
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
	        	console.log(response);
	        	var uri = response.voiceUris[0].uri;
	        	console.log(uri);
	        	return uri;
	        } else {
	        	console.log(response);
	        }
	    });
	};
});

app.post('/configure', function(req, res){
	
});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});


module.exports = app;
