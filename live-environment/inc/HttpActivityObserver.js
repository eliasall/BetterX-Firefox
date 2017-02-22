//	www.betterX.org
//	elias allayiotis

const {Cc, Ci, Cu} = require("chrome");
const cons = Cu.import("resource://gre/modules/devtools/Console.jsm", {}).console;

var Windows = require("./Windows.js");
var HttpHelper = require("./http.js");
var nsIHttpActivityObserver = Ci.nsIHttpActivityObserver;
var nsISocketTransport = Ci.nsISocketTransport;
var NetMonitor = require("./NetMonitor.js");

// HTTP Activity Observer
// Listen for HTTP events which provides detailed information about transferred data (headers, content, timings)
// Based on https://developer.mozilla.org/en-US/docs/Monitoring_HTTP_activity
var NetHttpActivityObserver =
{
    registered: false,

    registerObserver: function()
    {
        if (!Ci.nsIHttpActivityDistributor)
            return;

        if (this.registered)
            return;

        var distributor = this.getActivityDistributor();
        if (!distributor)
            return;

        distributor.addObserver(this);
        this.registered = true;
    },

    unregisterObserver: function()
    {
        if (!Ci.nsIHttpActivityDistributor)
            return;

        if (!this.registered)
            return;

        var distributor = this.getActivityDistributor();
        if (!distributor)
            return;

        distributor.removeObserver(this);
        this.registered = false;
    },

    getActivityDistributor: function()
    {
        if (!this.activityDistributor)
        {
            try
            {
                var hadClass = Cc["@mozilla.org/network/http-activity-distributor;1"];
                if (!hadClass) {
					return null;
				}
				
                this.activityDistributor = hadClass.getService(Ci.nsIHttpActivityDistributor);
            }
            catch (err)
            {
                console.log("net.NetHttpActivityObserver; Activity Observer EXCEPTION", err);
            }
        }
        return this.activityDistributor;
    },

    /* nsIActivityObserver */
    observeActivity: function(httpChannel, activityType, activitySubtype, timestamp, extraSizeData, extraStringData)
    {
        try
        {
            if (httpChannel instanceof Ci.nsIHttpChannel) {
				this.ParseHttpRequestActivity(httpChannel, activityType, activitySubtype, timestamp, extraSizeData, extraStringData);
			}
		}
		catch (ex) {}
	},
	
	ParseHttpRequestActivity: function(httpChannel, activityType, activitySubtype, timestamp, extraSizeData, extraStringData)
    {
        var win = Windows.GetWindowForRequest(httpChannel);
        var tabid = win ? Windows.GetTabIdForWindow(win) : 0;
		
        if (!(tabid && win))
            return;

        // get timestamp of event
		var time = new Date();
        time.setTime(timestamp / 1000);
        time = time.getTime();
		
		// HTTP transport activity has occurred
        if (activityType == nsIHttpActivityObserver.ACTIVITY_TYPE_HTTP_TRANSACTION) {
			// The HTTP request is about to be queued for sending; request headers in extraStringData
            if (activitySubtype == nsIHttpActivityObserver.ACTIVITY_SUBTYPE_REQUEST_HEADER) {
                var isXHR = HttpHelper.IsXHR(httpChannel);
                this.HandleRequestedHeaderFile(httpChannel, time, tabid, isXHR, extraStringData);
			// The HTTP transaction has been closed
			} else if (activitySubtype == nsIHttpActivityObserver.ACTIVITY_SUBTYPE_TRANSACTION_CLOSE)
                this.HandleClosedFile(httpChannel, time, tabid);
			// The HTTP response header has arrived
            else if (activitySubtype == nsIHttpActivityObserver.ACTIVITY_SUBTYPE_RESPONSE_HEADER)
                this.HandleRespondedHeaderFile(httpChannel, time, tabid, extraStringData);
			// The HTTP request's body has been sent
            else if (activitySubtype == nsIHttpActivityObserver.ACTIVITY_SUBTYPE_REQUEST_BODY_SENT)
                this.HandleBodySentFile(httpChannel, time, tabid);
			// The HTTP response has started to arrive
            else if (activitySubtype == nsIHttpActivityObserver.ACTIVITY_SUBTYPE_RESPONSE_START)
                this.HandleResponseStartedFile(httpChannel, time, tabid);
			// The complete HTTP response has been received
            else if (activitySubtype == nsIHttpActivityObserver.ACTIVITY_SUBTYPE_RESPONSE_COMPLETE)
                this.HandleResponseCompletedFile(httpChannel, time, tabid, extraSizeData);
			
		// Socket transport activity has occurred
        } else if (activityType == nsIHttpActivityObserver.ACTIVITY_TYPE_SOCKET_TRANSPORT) {
			// Transport is resolving the host. Usually a DNS lookup
            if (activitySubtype == nsISocketTransport.STATUS_RESOLVING)
                this.HandleResolvingFile(httpChannel, time, tabid);
            else if (activitySubtype == nsISocketTransport.STATUS_CONNECTING_TO)
                this.HandleConnectingFile(httpChannel, time, tabid);
            else if (activitySubtype == nsISocketTransport.STATUS_CONNECTED_TO)
                this.HandleConnectedFile(httpChannel, time, tabid);
            else if (activitySubtype == nsISocketTransport.STATUS_SENDING_TO)
                this.HandleSendingFile(httpChannel, time, tabid, extraSizeData);
            else if (activitySubtype == nsISocketTransport.STATUS_WAITING_FOR)
                this.HandleWaitingForFile(httpChannel, time, tabid);
            else if (activitySubtype == nsISocketTransport.STATUS_RECEIVING_FROM)
                this.HandleReceivingFile(httpChannel, time, tabid, extraSizeData);
        }
    },
	
	HandleRequestedHeaderFile: function(request, time, tabid, isXHR, extraStringData)
	{
		//cons.log("HandleRequestedHeaderFile");
		
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// Get and save data available for this event
			node.request.httpVersion = HttpHelper.GetHTTPVersion(extraStringData);
			var tmpHeaders = HttpHelper.GetRequestHeaders(extraStringData);
			node.request.headers = tmpHeaders.headers;
			HttpHelper.GetQueryString(extraStringData, node.request.queryString);
			node.request.cookieNumber = tmpHeaders.cookieNumber;
			node.request.headerSize = tmpHeaders.headersSize;
		}
	},
	
	HandleClosedFile: function(request, time, tabid)
	{
		//cons.log("HandleClosedFile");
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// Get and save data available for this event
			if (!node.timingsObj.loaded) {

                if (!node.timingsObj.responseStarted) {
                    node.timingsObj.respondedTime = time;
                    node.timingsObj.responseStarted = true;
                }

                node.timingsObj.endTime = time;
				loaded = true;
            }
		}
	},
	
	HandleRespondedHeaderFile: function(request, time, tabid, extraStringData)
	{
		//cons.log("HandleRespondedHeaderFile");
		
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// Get and save data available for this event
			node.response.httpVersion = extraStringData.substring(0, 8);
			node.response.headersSize = extraStringData.length;
		}
	},
	
	HandleBodySentFile: function(request, time, tabid)
	{
		//cons.log("HandleBodySentFile");
		
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// Get and save data available for this event
			var tmpPostData = HttpHelper.GetPostData(request);
			node.request.bodySize = tmpPostData.bodysize;
			node.request.postData = tmpPostData.postData;
			// "Content-Length" header could be not obtained in 'HandleRequestedHeaderFile', set it here
			node.request.headers["Content-Length"] = tmpPostData.bodysize;
		}
	},
	
	HandleResponseStartedFile: function(request, time, tabid)
	{
		//cons.log("HandleResponseStartedFile");
		
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// Get and save data available for this event
			if (!node.timingsObj.responseStarted) {
				node.timingsObj.respondedTime = time;
				node.timingsObj.responseStarted = true;
			}

			node.timingsObj.endTime = time;
		}
	},
	
	HandleResponseCompletedFile: function(request, time, tabid, extraSizeData)
	{
		//cons.log("HandleResponseCompletedFile");
	
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// Get and save data available for this event
			node.serverIPAddress = HttpHelper.GetRemoteAddress(request);
			node.connection = HttpHelper.GetRemotePort(request);
			node.response.bodySize = extraSizeData;
			// "Content-Length" header could be not obtained in 'HandleRequestedHeaderFile', set it here
			if (node.response.headers["Content-Length"] == "") {
				node.response.headers["Content-Length"] = extraSizeData;
			}
		}
	},
	
	HandleResolvingFile: function(request, time, tabid)
	{
		//cons.log("HandleResolvingFile");
		
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// Get and save data available for this event
			if (node.timingsObj.loaded) {
				// this event may occur too late, so skip it if request already loaded
				return null;
			}

			if (!node.timingsObj.resolveStarted) {
				node.timingsObj.resolveStarted = true;
				node.timingsObj.resolvingTime = time;
				node.timingsObj.connectingTime = time; // in case connecting would never came.
				node.timingsObj.connectedTime = time; // in case connected-to would never came.
				node.timingsObj.sendingTime = time;  // in case sending-to would never came.
				node.timingsObj.waitingForTime = time; // in case waiting-for would never came.
			}
		}
	},
	
	HandleConnectingFile: function(request, time, tabid)
	{
		//cons.log("HandleConnectingFile");
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// Get and save data available for this event
			if (node.timingsObj.loaded) {
				// this event may occur too late, so skip it if request already loaded
				return null;
			}

			if (!node.timingsObj.connectStarted) {
				node.timingsObj.connectStarted = true;
				node.timingsObj.connectingTime = time;
				node.timingsObj.connectedTime = time; // in case connected-to would never came.
				node.timingsObj.sendingTime = time;  // in case sending-to would never came.
				node.timingsObj.waitingForTime = time; // in case waiting-for would never came.
			}
		}
	},
	
	HandleConnectedFile: function(request, time, tabid)
	{
		//cons.log("HandleConnectedFile");
	},
	
	HandleSendingFile: function(request, time, tabid, extraSizeData)
	{
		//cons.log("HandleSendingFile");
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// Get and save data available for this event
			if (!node.timingsObj.sendStarted) {
				node.timingsObj.sendingTime = time;
				node.timingsObj.waitingForTime = time; // in case waiting-for would never came.
				node.timingsObj.sendStarted = true;
			}

			// It can happen that "connected" event sometimes comes after sending,
			// which doesn't make much sense (Firefox bug?)
			if (!node.timingsObj.connected) {
				node.timingsObj.connected = true;
				node.timingsObj.connectedTime = time;
			}

			node.timingsObj.loaded = false;
			node.timingsObj.responseStarted = false;
		}
	},
	
	HandleWaitingForFile: function(request, time, tabid)
	{
		//cons.log("HandleWaitingForFile");
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// Get and save data available for this event
			if (!node.timingsObj.waitingStarted) {
				node.timingsObj.waitingForTime = time;
				node.timingsObj.waitingStarted = true;
			}
		}
	},
	
	HandleReceivingFile: function(request, time, tabid, extraSizeData)
	{
		//cons.log("HandleReceivingFile");
		var node = NetMonitor.GetNode(request, tabid);
		
		if (node) {
			// request is complete
			node.timingsObj.endTime = time;
		}
	}
	
} // end NetHttpActivityObserver

function StartHttpActivityObserve()
{
	NetHttpActivityObserver.registerObserver();
}

function StopHttpActivityObserve()
{
	NetHttpActivityObserver.unregisterObserver();
}

exports.StartHttpActivityObserve = StartHttpActivityObserve;
exports.StopHttpActivityObserve = StopHttpActivityObserve;