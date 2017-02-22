//	www.betterX.org
//	elias allayiotis

const {Cc, Ci, Cu} = require("chrome");
//const cons = Cu.import("resource://gre/modules/devtools/Console.jsm", {}).console;
const NS_SEEK_SET = Ci.nsISeekableStream.NS_SEEK_SET;

// Helper functions to work with request, response, headers, POST data, cookies e.t.c
// based on \furebug\content\firebug\lib\http.js

// Check if request is XHR
function IsXHR(request)
{
    try {
        var callbacks = request.notificationCallbacks;
        var xhrRequest = callbacks ? callbacks.getInterface(Ci.nsIXMLHttpRequest) : null;
        return (xhrRequest != null);
    }
    catch (exc) {
		//cons.log(exc.message);
	}

    return false;
}

// Get remote port from request
function GetRemotePort(request)
{
    try {
        if (request instanceof Ci.nsIHttpChannelInternal) {
            return request.remotePort;
		}
    }
    catch (err) {
		//cons.log(err.message);
	}
	
    return null;
};

// Get remote server address from request
function GetRemoteAddress(request)
{
    try {
        if (request instanceof Ci.nsIHttpChannelInternal) {
            return request.remoteAddress;
		}
    }
    catch (err) {
		//cons.log(err.message);
    }
	
    return null;
};

function GetHTTPVersion(extraStringData)
{
	if (extraStringData.indexOf("HTTP/1.1") == -1) {
		return "HTTP/1.0";
	} else {
		return "HTTP/1.1";
	}
}

// Parse extraStringData(contains request headers) and get query string
function GetQueryString(extraStringData, nodeQueryArr)
{
	var queryStr = "";
	
	try {
		var splitted = extraStringData.split('\r\n', 2);
		
		if (splitted[0]) {
			var idx = splitted[0].indexOf("?");
			
			if (idx != -1) {
				queryStr = splitted[0].substring(idx + 1, splitted[0].lastIndexOf(" "));
				splitted = queryStr.split('&');
				
				for (var i = 0; i < splitted.length; i++) {
					idx = splitted[i].indexOf("=");
					if (idx != -1) {
						nodeQueryArr.push({"name": splitted[i].substring(0, idx), "value": ""});
					}
				}
			}
		}
	} catch (err) {
		//cons.log(err.message);
	}
	
	return queryStr;
}

// Parse extraStringData(contains request headers) and get request headers
function GetRequestHeaders(extraStringData)
{
	var headersNames = ["Host:", "User-Agent:", "Accept:", "Accept-Encoding:", "Content-Length:", "Keep-Alive", "Connection:"];
	var headers = {};
	var cookieNumber = 0;
	var cookieFound = false;
	// Get headers size
	var headersSize = extraStringData.length;
	
	try {
		var splitted = extraStringData.split('\r\n');
	
		for (var i = 0; i < splitted.length; i++) {
			for (var j = 0; j < headersNames.length; j++) {
				var idx = splitted[i].indexOf(headersNames[j]);
				if (idx != -1) {
					headers[headersNames[j]] = splitted[i].substring(headersNames[j].length + 1);
					continue;
				}
				
				// check for cookies also
				if (!cookieFound) {
				
					idx = splitted[i].indexOf("Cookie:");
					
					if (idx != -1) {
						cookieFound = true;
						cookieNumber = splitted[i].substring(8).split(";").length;
					}
				}
			}
		}
	} catch (err) {
		//cons.log(err.message);
	}
	
	// return combined result
	return {"headers": headers, "cookieNumber": cookieNumber, "headersSize": headersSize};
}

// Read bytes from stream (used for get POST data)
function ReadFromStream(stream)
{
    var sis = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
	
    sis.init(stream);

    var segments = [];
    for (var count = stream.available(); count; count = stream.available()) {
        segments.push(sis.readBytes(count));
	}

	// concatenate bytes and return string
    return segments.join("");
}

// Read POST data from stream associated with request
function ReadPostTextFromRequest(request)
{
    try
    {
        var is = (request instanceof Ci.nsIUploadChannel) ? request.uploadStream : null;
		
        if (is)
        {
            if (!(is instanceof Ci.nsISeekableStream))
                return;

            var ss = is;
            var prevOffset;
            if (ss)
            {
                prevOffset = ss.tell();
                ss.seek(NS_SEEK_SET, 0);
            }

            // Read data from the stream
            var text = ReadFromStream(is);
            // Seek locks the file, so seek to the beginning only if necko hasn't read it yet,
            // since necko doesn't seek to 0 before reading (at least not till 459384 is fixed).
            if (ss && prevOffset == 0) {
                ss.seek(NS_SEEK_SET, 0);
			}
			
            return text;
        }
    }
    catch(exc)
    {
        cons.log("http.readPostTextFromRequest FAILS " + exc.message);
    }

    return null;
}

// Get POST data from stream associated with request object and parse it
function GetPostData(request)
{
	var isMultipartForm = false;
	var bodysize = 0;
	var postData = {
		"mimeType": "",
		"params": [],
		"text": "",
	};
	
	var postText = ReadPostTextFromRequest(request);
	
	if (postText) {
		
		var idx = postText.indexOf("\r\n\r\n");
		if (idx != -1) {
			var header = postText.substring(0, idx);
			var body = postText.substring(idx + 4);
			
			bodysize = body.length;
			
			idx = postText.indexOf("Content-Type:");
			if (idx != -1) {
				postData.mimeType = header.substring(idx + 14, header.indexOf("\r\n"));
				if (postData.mimeType.indexOf("multipart") != -1) {
					isMultipartForm = true;
				}
			}
			
			if (isMultipartForm) {
				
				var fNameIdx = body.indexOf("filename=\"");
				
				if (fNameIdx != -1) {
					// remove file data (can be huge)
					body = body.substring(0, body.indexOf("\r\n\r\n", fNameIdx));
				}
				
				var params = body.split(" name=\"");
				
				for (var i = 0; i < params.length; i++) {
					
					var quoteSign = params[i].indexOf("\"");
						fNameIdx = params[i].indexOf("filename=\"");
					var fName = (fNameIdx != -1) ? (params[i].substring(fNameIdx + 10, params[i].indexOf("\"", fNameIdx + 10))) : "";
					var cntType = (fNameIdx != -1) ? params[i].substring(fNameIdx + 10 + fName.length + 1 + 16) : "";
					
					if (quoteSign != -1) {
						postData.params.push({
							"name": params[i].substring(0, quoteSign),
							"value": "",
							"fileName": fName,
							"contentType": cntType
						});
					}
				}
					
			} else {
				
				var params = body.split("&");
				
				for (var i = 0; i < params.length; i++) {
					var equalSign = params[i].indexOf("=");
					
					if (equalSign != -1) {
						postData.params.push({
							"name": params[i].substring(0, equalSign),
							"value": ""
						});
					}
				}
			}
		}
	}
	
	return { "bodysize": bodysize, "postData": postData };
}

// Get response headers from request object
function GetResponseHeaders(request)
{
	var headers = {};
	var cookieNumber = 0;
	var redirectURL = "";
	var headersSize = 0;
	
	if (!(request instanceof Ci.nsIHttpChannel)) {
		return null;
	}

	try
	{
		var responseHeaders = [];
		
		request.visitResponseHeaders({
			// Get headers name and value in callback
			visitHeader: function(name, value)
			{
				responseHeaders[name] = value;
				headersSize = headersSize + name.length + value.length + ": ".length;
			}
		});
		
		// fill object with headers info
		headers = {
			"Date": responseHeaders["Date"] ? responseHeaders["Date"] : "",
			"Server": responseHeaders["Server"] ? responseHeaders["Server"] : "",
			"X-Powered-By": responseHeaders["X-Powered-By"] ? responseHeaders["X-Powered-By"] : "",
			"Content-Encoding": responseHeaders["Content-Encoding"] ? responseHeaders["Content-Encoding"] : "",
			"Content-Length": responseHeaders["Content-Length"] ? responseHeaders["Content-Length"] : "",
			"Keep-Alive": responseHeaders["Keep-Alive"] ? responseHeaders["Keep-Alive"] : "",
			"Connection": responseHeaders["Connection"] ? responseHeaders["Connection"] : "",
			"Content-Type": responseHeaders["Content-Type"] ? responseHeaders["Content-Type"] : ""
		};
		
		// If server send cookies to browser
		if (responseHeaders["set-cookie"]) {
			cookieNumber = responseHeaders["set-cookie"].split(";").length;
		}
		
		// If request is redirected
		if (responseHeaders["Location"]) {
			redirectURL = responseHeaders["Location"];
		}
	}
	catch (e) {
		cons.log(e.message);
	}
	
	// return combined result
	return {"headers": headers, "cookieNumber": cookieNumber, "redirectURL": redirectURL, "headersSize": headersSize};
}

// Get request headers from cached request object (similar to GetResponseHeaders())
function GetRequestCachedHeaders(request)
{
	var headers = {};
	var cookieNumber = 0;
	var headersSize = 0;
	
	if (!(request instanceof Ci.nsIHttpChannel)) {
		return null;
	}

	try
	{
		var requestHeaders = [];
		var requestHeadersNames = [];
		
		request.visitRequestHeaders({
			visitHeader: function(name, value)
			{
				requestHeaders[name] = value;
				headersSize = headersSize + name.length + value.length + ": ".length;
			}
		});
		
		headers = {
			"Host": requestHeaders["Host"] ? requestHeaders["Host"] : "",
			"User-Agent": requestHeaders["User-Agent"] ? requestHeaders["User-Agent"] : "",
			"Accept": requestHeaders["Accept"] ? requestHeaders["Accept"] : "",
			"Accept-Encoding": requestHeaders["Accept-Encoding"] ? requestHeaders["Accept-Encoding"] : "",
			"Content-Length": requestHeaders["Content-Length"] ? requestHeaders["Content-Length"] : "",
			"Keep-Alive": requestHeaders["Keep-Alive"] ? requestHeaders["Keep-Alive"] : "",
			"Connection": requestHeaders["Connection"] ? requestHeaders["Connection"] : "",
		};
		
		if (requestHeaders["Cookie"]) {
			cookieNumber = requestHeaders["Cookie"].split(";").length;
		}
	}
	catch (e) {
		cons.log(e.message);
	}
	
	return {"headers": headers, "cookieNumber": cookieNumber, "headersSize": headersSize};
}

// Get time when request ceased to be blocked
function GetBlockingEndTime(timeObj)
{
	if (timeObj.resolveStarted && timeObj.connectStarted)
		return timeObj.resolvingTime;

	if (timeObj.connectStarted)
		return timeObj.connectingTime;

	if (timeObj.sendStarted)
		return timeObj.sendingTime;

	return timeObj.waitingForTime;
}

// Get request URL without values within query string
function GetCleanedRquestName(rName)
{
	var cleanedUrl = "";
	var idx = rName.indexOf("?");
			
	if (idx != -1) {
		
		cleanedUrl = rName.substring(0, idx + 1);
		queryStr = rName.substring(idx + 1);
		var splitted = queryStr.split('&');
		
		for (var i = 0; i < splitted.length; i++) {
			idx = splitted[i].indexOf("=");
			if (idx != -1) {
				cleanedUrl = cleanedUrl + splitted[i].substring(0, idx) + "=&";
			}
		}
		
		cleanedUrl = cleanedUrl.substr(0, cleanedUrl.length - 1);
		
		return cleanedUrl;
	} else {
		return rName;
	}
}
	
exports.IsXHR = IsXHR;
exports.GetRemotePort = GetRemotePort;
exports.GetRemoteAddress = GetRemoteAddress;
exports.GetHTTPVersion = GetHTTPVersion;
exports.GetRequestHeaders = GetRequestHeaders;
exports.GetQueryString = GetQueryString;
exports.GetPostData = GetPostData;
exports.GetResponseHeaders = GetResponseHeaders;
exports.GetRequestCachedHeaders = GetRequestCachedHeaders;
exports.GetBlockingEndTime = GetBlockingEndTime;
exports.GetCleanedRquestName = GetCleanedRquestName;


