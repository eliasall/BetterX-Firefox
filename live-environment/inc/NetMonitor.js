//	www.betterX.org
//	elias allayiotis

const {Cc, Ci, Cu} = require("chrome");
//const cons = Cu.import("resource://gre/modules/devtools/Console.jsm", {}).console;

var Windows = require("./Windows.js");
var CacheHelper = require("./CacheProvider.js");
var NetHttpActivityObserver = require("./HttpActivityObserver.js");
var HttpHelper = require("./http.js");
var writableDir = require("./WritableDir.js");
// New tab for mobile version of FF has different name
var homeTab = "about:home";	// mobile
//var homeTab = "about:newtab";	// desktop

// ID to denote and destinguish different pages within one tab
var basePageId = 0;

var IsAbsoluteUrl = function(url)
{
    return (/^(?:[a-z]+:)?\/\//i.test(url))
}

// Object to store web info for one page
function CNetSession()
{
	this.pageNode = null;
	this.entriesNode = [];
}

function now()
{
	return (new Date()).getTime();
}

// Listens for request/response events and handles them
// Based on https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Tabbed_browser#Getting_the_browser_that_fires_the_http-on-modify-request_notification_(example_code_updated_for_loadContext)
var httpRequestObserver =
{
	// sessions used to store data collected for a tab from first 'on-opening-request' to last 'on-examine-response'
	tabNetSessions: [],
	
	// called every time when request is made or responce arrived
	observe: function(subject, topic, data)
	{
		if (!(subject instanceof Ci.nsIHttpChannel)) {
			return;
		}
		
		// Get window associated with request
		var win = Windows.GetWindowForRequest(subject);
		if (!Windows.GetWindowForRequest) {
			//cons.log("Error: Windows.GetWindowForRequest is undefined");
		}
		
		// Some requests are not associated with any page (e.g. favicon).
		// These are ignored as we can log only page requests.
		// Get tab ID associated with window
		var tabid = win ? Windows.GetTabIdForWindow(win) : null;

		if (tabid) {
			// http request is made
			if (topic == "http-on-modify-request") {
				this.OnModify(subject, tabid, win);
			// http response arrived
			} else if (topic == "http-on-examine-response") {
				this.OnExamine(subject, tabid, win);
			// response from cache arrived
			} else if (topic == "http-on-examine-cached-response") {
				this.OnCached(subject, tabid, win);
			}
		}
	},

	get observerService() {
		return Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	},

	register: function()
	{
		this.observerService.addObserver(this, "http-on-modify-request", false);
		this.observerService.addObserver(this, "http-on-examine-response", false);
		this.observerService.addObserver(this, "http-on-examine-cached-response", false);
	},

	unregister: function()
	{
		this.observerService.removeObserver(this, "http-on-modify-request");
		this.observerService.removeObserver(this, "http-on-examine-response");
		this.observerService.removeObserver(this, "http-on-examine-cached-response");
	},
	
	OnModify: function(request, tabid, win)
	{
		// filter requests wich we could not handle
		if (win.location.host == "browser" || (!IsAbsoluteUrl(win.location.href) && win.location.href != homeTab)) {
			return;
		}
		
		var time = now();
		// Try to get existing session
		var tabNetSession = this.tabNetSessions[tabid];
		
		if (!tabNetSession  ) {
			// Ensure that this is first, top level document request
			if ((request.loadFlags & Ci.nsIChannel.LOAD_DOCUMENT_URI) &&
            request.loadGroup && request.loadGroup.groupObserver &&
            win == win.parent && (request.URI.asciiSpec == request.originalURI.asciiSpec)) {
				
				// create new session and associate it with tab ID
				this.tabNetSessions[tabid] = new CNetSession();
			
				//cons.log("New Net Session: " + tabid);
				
				tabNetSession = this.tabNetSessions[tabid];
				
				// start Http activity listening
				NetHttpActivityObserver.StartHttpActivityObserve();
				
				basePageId++;
				
				// create page node object with default values
				tabNetSession.pageNode = {
					"tabid": tabid,
					"pageStartTime": time,
					"pageid": basePageId + tabid,
					"pagetitle": win.document.title,	// filed after 'onModify'/'onCache' events
					"pageOnContentLoad": -1,			// filled after 'DOMContentLoaded' event
					"pageOnLoad": -1,					// filled after 'load' event
					"origin": "",						// Firefox does not provide API to get origin

				};
			}
		}
		
		// add request node object with default values
		if (tabNetSession) {
			tabNetSession.entriesNode.push({
				"timingsObj": {							// store timestamps here to calculate timings later
					"startTime": time,
					"endTime": time,
					"resolvingTime": time,
					"connectingTime": time,
					"connectedTime": time,
					"sendingTime": time,
					"waitingForTime": time,
					"respondedTime": time,
					"responseStarted": false,
					"waitingStarted": false,
					"sendStarted": false,
					"connected": false,
					"connectStarted": false,
					"loaded": false,
					"resolveStarted": false
				},
				"requestObj": request,						// remember request to be ablle to distinguish nodes in HttpActivityObserver
				
				"pageid": tabNetSession.pageNode.pageid,
				"entryStartTime": time,
				"time": 0,									// sum of timings
				"request": {								// filled after 'REQUEST_HEADER' and 'REQUEST_BODY_SENT' HttpActivity events -->
					"method": request.requestMethod,
					"url": HttpHelper.GetCleanedRquestName(request.name),
					"httpVersion": "",
					"cookieNumber": 0,
					"headers": {},
					"queryString": [],
					"postData": {},
					"headerSize": -1,
					"bodySize": -1							// <--

				},
				"response": {						// filled after 'OnExamine' and 'RESPONSE_HEADER' events -->
					"status": 200,
					"statusText": "",
					"httpVersion": "",
					"cookieNumber": "",
					"headers": {
						"Date": "",
						"Server": "",
						"X-Powered-By": "",
						"Content-Encoding": "",
						"Content-Length": 0,
						"Connection": "",
						"Content-Type": ""			//  <--
					},
					"content": {
						"size": "",
						"compression": "",
						"mimeType": "",
						"text": "",
						"encoding": "",
					},
					"redirectURL": "",				// filled after 'OnExamine' and 'RESPONSE_HEADER' events -->
					"headersSize": 0,				//
					"bodySize": 0					// <--
				},
				"cache": {
					"beforeRequestCacheEntries": 0,
					"afterRequestCacheEntries": 0,
					"hitCount": 0

				},
				"timings": {						// calculated after page is complete
					"blocked": 0,
					"dns": 0,
					"connect": 0,
					"send": 0,			// must have non-negative vales
					"wait": 0,			// must have non-negative vales
					"receive": 0,		// must have non-negative vales
					"ssl": 0
				},
				"serverIPAddress": "",	// filled after 'RESPONSE_COMPLETE' HttpActivity event
				"connection": ""		//  <--
			});
			
			var node = GetNode(request, tabid);
		
			if (node) {
				// get cache info before request complete
				CacheHelper.GetCacheEntriesNumber(function (numberOfEntries) {
					node.cache.beforeRequestCacheEntries = numberOfEntries;
				});
			}
		}
	},
	
	// http response arrived
	OnExamine: function(request, tabid, win)
	{
		// Get request node assosiated with 'tabid' and 'request'
		var node = GetNode(request, tabid);
		
		if (node) {
			
			var headersInfo = HttpHelper.GetResponseHeaders(request);
			
			// get page title
			this.tabNetSessions[tabid].pageNode.pagetitle = win.document.title;
			
			node.response.headers = headersInfo.headers;
			node.response.cookieNumber = headersInfo.cookieNumber;
			node.response.redirectURL = headersInfo.redirectURL;
			node.response.status = request.responseStatus;
			node.response.statusText = request.responseStatusText;
			
			if (request.contentLength && node.response.bodySize == 0) {
				node.response.bodySize = request.contentLength;
			}
			
			node.response.content.size = node.response.bodySize;
			node.response.content.compression = 0;
			node.response.content.mimeType = node.response.headers["Content-Type"] ? node.response.headers["Content-Type"] : "";
			node.response.content.encoding = request.contentCharset;
			
			// get cache info after response
			CacheHelper.GetCacheEntriesNumber(function (numberOfEntries) {
				node.cache.afterRequestCacheEntries = numberOfEntries;
			});
			
			node.timingsObj.loaded = true;
		}
	},
	
	OnCached: function(request, tabid, win)
	{
		// Get entries node assosiated with 'tabid' and 'request'
		var node = GetNode(request, tabid);
		
		if (node) {
			
			var time = now();
			if (node.timingsObj.waitingStarted)
                time = node.timingsObj.waitingForTime;

            if (!node.timingsObj.responseStarted)
            {
                node.timingsObj.respondedTime = time;
                node.timingsObj.responseStarted = true;
            }

            node.timingsObj.endTime = time;
			node.timingsObj.loaded = true;
			
			// get page title
			this.tabNetSessions[tabid].pageNode.pagetitle = win.document.title;
			
			// get cache info
			CacheHelper.GetCacheEntrieHitCount(function(fetchCount) {
				node.cache.hitCount = fetchCount;
			}, 
			request.URI.asciiSpec);
			
			// Get all possible info which is not arrived to HttpActivityObserver due to the fact that request was cached
			var tmpHeaders = HttpHelper.GetRequestCachedHeaders(request);
			
			node.request.headers = tmpHeaders.headers;
			node.request.headerSize = tmpHeaders.headersSize;
			
			var tmpPostData = HttpHelper.GetPostData(request);
			
			node.request.bodySize = tmpPostData.bodysize;
			node.request.postData = tmpPostData.postData;
			node.request.headers["Content-Length"] = tmpPostData.bodysize;
			
			var headersInfo = HttpHelper.GetResponseHeaders(request);
			
			node.response.headers = headersInfo.headers;
			node.response.redirectURL = headersInfo.redirectURL;
			node.response.status = request.responseStatus;
			node.response.statusText = request.responseStatusText;
			
			node.response.headersSize = headersInfo.headersSize;
			
			node.response.bodySize = 0;
			
			node.response.content.size = request.contentLength;;
			node.response.content.compression = 0;
			node.response.content.mimeType = node.response.headers["Content-Type"] ? node.response.headers["Content-Type"] : "";
			node.response.content.encoding = request.contentCharset;
			
			// get cache info after response
			CacheHelper.GetCacheEntriesNumber(function (numberOfEntries) {
				node.cache.afterRequestCacheEntries = numberOfEntries;
			});
		}
	},
	
	// Page is completely loaded, save session to file and delete it
	OnPageComplete: function(tabid)
	{
		// Get session assosiated with 'tabid'
		var tabNetSession = httpRequestObserver.tabNetSessions[tabid];
		
		try {
			if (tabNetSession) {
				
				for (var i = 0; i < tabNetSession.entriesNode.length; i++) {
					
					// calculate timings for each request
					var t = tabNetSession.entriesNode[i].timingsObj;
					var blockingEnd = HttpHelper.GetBlockingEndTime(t);
					var node = tabNetSession.entriesNode[i];
					
					// set blocking time to -1 if request was cached
					node.timings.blocked = (node.cache.hitCount == 0) ? blockingEnd - t.startTime : -1;
					// set resolving time to -1 if request was cached or resolving event did hot happen
					node.timings.dns = (node.cache.hitCount == 0 && t.resolveStarted) ? t.connectingTime - t.resolvingTime : -1;
					// set connecting time to -1 if connecting event did hot happen
					node.timings.connect = t.connectStarted ? t.sendingTime - t.connectingTime : -1
					// set ssl time to -1 if it was not secured connection
					node.timings.ssl = (node.connection != 443) ? -1 : 0;
					// set send time to 0 if send event did hot happen
					node.timings.send = t.sendStarted ? t.waitingForTime - t.sendingTime : 0;
					node.timings.wait = t.respondedTime - t.waitingForTime;
					node.timings.receive = t.endTime - t.respondedTime;
					
					// summarize all timings excluding not applied (-1)
					node.time = node.time + ((node.timings.blocked != -1) ? node.timings.blocked : 0) +
					((node.timings.dns != -1) ? node.timings.dns : 0) +
					((node.timings.connect != -1) ? node.timings.connect : 0) +
					((node.timings.ssl != -1) ? node.timings.ssl : 0) +
					node.timings.send +
					node.timings.wait +
					node.timings.receive;
					
					// remove requestObj and timingsObj field before writing to file
					node.requestObj = undefined;
					node.timingsObj = undefined;
				}
				
				// write collected data from the tab to file
				var data = JSON.stringify(tabNetSession);
				writableDir.SaveLogData(data, writableDir.LogTypes.Web);
				
				// delete collected data
				delete httpRequestObserver.tabNetSessions[tabid];
				//cons.log(tabid + " \t complete and logged to file");
			}
		} catch (ex) {
			//cons.log(ex.message);
		}
		
	},
	
	QueryInterface : function (aIID)
	{
		if (aIID.equals(Ci.nsIObserver) ||
			aIID.equals(Ci.nsISupports))
		{
			return this;
		}

		throw Components.results.NS_NOINTERFACE;
	}
};

// Get session associated with tab ID
function GetTabNetSession(tabid)
{
	var tabNetSession = httpRequestObserver.tabNetSessions[tabid];
		
	if (!tabNetSession) {
		return null;
	}
	
	return tabNetSession;
}

// Called from 'NetProgressListener' when 'onStateChange' event happens with STATE_STOP & STATE_IS_WINDOW flags
// which means that page is completely loaded
function OnPageComplete(tabid)
{
	httpRequestObserver.OnPageComplete(tabid);
}

// Get entries node assosiated with 'tabid' and 'request'
function GetNode(request, tabid)
{
	var tabNetSession = GetTabNetSession(tabid);
	if (tabNetSession) {
		var node = GetEntriesNode(request, tabNetSession);
		
		if (node) {
			return node;
		}
	}
	
	return null;
}

// Get entries node assosiated with 'request' from session
function GetEntriesNode(request, tabNetSession)
{
	for (var i = 0; i < tabNetSession.entriesNode.length; i++) {
		var node = tabNetSession.entriesNode[i];
		if (node.requestObj == request) {
			return node;
		}
	}
	
	return null;
}

function RegisterObservers()
{
	httpRequestObserver.register();
}

function UnRegisterObservers()
{
	httpRequestObserver.unregister();
}

exports.RegisterObservers = RegisterObservers;
exports.UnRegisterObservers = UnRegisterObservers;
exports.OnPageComplete = OnPageComplete;
exports.GetTabNetSession = GetTabNetSession;
exports.GetNode = GetNode;