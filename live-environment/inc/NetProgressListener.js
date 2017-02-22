//	www.betterX.org
//	elias allayiotis

const {Cc, Ci, Cu} = require("chrome");
//const cons = Cu.import("resource://gre/modules/devtools/Console.jsm", {}).console;
const {setTimeout} = require("sdk/timers");

var NetMonitor = require("./NetMonitor.js");
var Windows = require("./Windows.js");
var writableDir = require("./WritableDir.js");
var LogTypes = writableDir.LogTypes;

// Reasons for onStateChange() event
const STATE_STOP = Ci.nsIWebProgressListener.STATE_STOP;
const STATE_IS_WINDOW = Ci.nsIWebProgressListener.STATE_IS_WINDOW;

// Do not reexecute locationChange if it's in progress.
var locationInProgress = false;

// Recursive function which waits until tabs file is unlocked or until it is called 'maxRecursionLevel' times
// and then executes the callback
var maxRecursionLevel = 20;
var level = 0;
function WaitForMS(callback) {
	if (!tabsDataWriter.FileLocked()) {
		callback();
		level = 0;
	} else {
		if (level > maxRecursionLevel) {
			callback();
			level = 0;
		} else {
			level++;
			setTimeout(function() {
				WaitForMS(callback);
			}, 50);
		}
	}
}

// Listens for events: 'TabOpen', 'TabClose', 'TabSelect', 'DOMContentLoaded' and 'load'.
// Also listens for onStateChange() event with flags STATE_STOP and STATE_IS_WINDOW which means that page is completely loaded
// and session data can be saved to file. 'DOMContentLoaded' and 'load' events can occur earlier when some requests are not complete.
// Based on https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Progress_Listeners
var NetProgressListener =
{
	// Called when the location of the window being watched changes and we need to start listening for 'DomContentLoade' and 'loaded' events
    onLocationChange: function(progress, request, uri)
    {
        if (locationInProgress) {
            return;
        }

        locationInProgress = true;

        try
        {
            this.doLocationChange(progress, request, uri);
        }
        catch (e)
        {
        }
        finally
        {
            locationInProgress = false;
        }
    },
	
	doLocationChange: function(progress, request, uri)
    {
        // Only watch windows that are their own parent - e.g. not frames
        if (progress.DOMWindow.parent == progress.DOMWindow)
        {
            if (uri) {
                var win = progress.DOMWindow;
				if (win instanceof Ci.nsIDOMWindow)
				{
					// This place can be called multiple times for one window, so
					// make sure event listeners are not registered twice.
					win.removeEventListener("load", onLoadEvent, false);
					win.removeEventListener("DOMContentLoaded", onLoadWindowContent, false);

					// Re-register again since it could have been done too soon before.
					win.addEventListener("load", onLoadEvent, false);
					win.addEventListener("DOMContentLoaded", onLoadWindowContent, false);
				}
				
				return;
            }
        }
    },
	
	// Handle tabs related events
	handleEvent: function(ev) {
		switch(ev.type) {
			case 'TabOpen':
				// register progress listener (mobile only)
				if (ev.target.webProgress) {
					ev.target.addProgressListener(this);
				}
				
				// log Opened event
				var tabid = Windows.GetTabIdFromEvent(ev);
		
				if (tabid) {
					//cons.log(tabid + " is opened");
					// save this event to file
					writableDir.SaveLogData({action: "Open", id: tabid}, LogTypes.Tabs);
				}	
			break;
			case 'TabClose':
				// unregister progress listener (mobile only)
				if (ev.target.webProgress) {
					ev.target.removeProgressListener(this);
				}
				
				// save this event to file
				var tabid = Windows.GetTabIdFromEvent(ev);
		
				if (tabid) {
					//cons.log(tabid + " is closed");	
					writableDir.SaveLogData({action: "Closed", id: tabid}, LogTypes.Tabs);
				}
			break;
			case 'TabSelect':
				// log Focused event
				var tabid = Windows.GetTabIdFromEvent(ev);
				if (tabid) {
					// Wait a little before writing to file after tab is focused to prevent concurent conditions for async write.
					// 'Opened' and 'Focused'   and   'Closed' and 'Focused' occurs simultaneously 
					setTimeout(function() {
						WaitForMS(function() {
							writableDir.SaveLogData({action: "Focused", id: tabid}, LogTypes.Tabs);
						});
					}, 150);
				}
			default:
			break;
		}
	},
	
	// Notification indicating the state has changed for one of the requests associated with aWebProgress
    onStateChange : function(aWebProgress, aRequest, aFlag, aStatus) {
		
		if (aFlag & STATE_STOP) {
			if (aFlag & STATE_IS_WINDOW) {
				
				// This fires when the page is loaded
				var win = aWebProgress.DOMWindow;
				
				if (win instanceof Ci.nsIDOMWindow) {
					
					var tabid = Windows.GetTabIdForWindow(win);
			
					if (tabid) {
						// call method responsible for saving session data
						NetMonitor.OnPageComplete(tabid);
					}
				}
			}
		}
	},
	
    onProgressChange : function() {},
	onStatusChange : function() {},
    onSecurityChange : function() {},
    onLinkIconAvailable : function() {},
	
	QueryInterface : function(iid)
    {
        if (iid.equals(Ci.nsIWebProgressListener) ||
            iid.equals(Ci.nsISupportsWeakReference) ||
            iid.equals(Ci.nsISupports))
        {
            return this;
        }

        throw Components.results.NS_NOINTERFACE;
    },
	
};

// 'loaded' event handler
function onLoadEvent(event)
{
	var win = event.currentTarget;
	var time = now();
	
    try {
		// remove this listener
        win.removeEventListener("load", onLoadEvent, false);
		if (win instanceof Ci.nsIDOMWindow) {
			var tabid = Windows.GetTabIdForWindow(win);
			if (tabid) {
				tabSession = NetMonitor.GetTabNetSession(tabid);
				if (tabSession) {
					tabSession.pageNode.pageOnLoad = time - tabSession.pageNode.pageStartTime;
				}
			}
		}
    }
    catch (e) {
        //cons.log(e.message);
    }
}

// // 'DOMContentLoaded' event handler
function onLoadWindowContent(event)
{
	var win = event.currentTarget;
	var time = now();
	
	try {
		// remove this listener
        win.removeEventListener("DOMContentLoaded", onLoadWindowContent, false);
		if (win instanceof Ci.nsIDOMWindow) {					
			var tabid = Windows.GetTabIdForWindow(win);
			if (tabid) {
				tabSession = NetMonitor.GetTabNetSession(tabid);
				if (tabSession) {
					tabSession.pageNode.pageOnContentLoad = time - tabSession.pageNode.pageStartTime;
				}
			}
		}
    }
    catch (e) {
		//cons.log(e.message);
    }
}

// Start progress listener
function StartNetProgressListen()
{
	// Get tab browser, BrowserApp for mobile annd gBrowser for desktop
	var tabBrowser = Windows.getTabBrowser();

	if (tabBrowser.addProgressListener) {
		// works in desktop FF
		//cons.log("start listen: " + tabBrowser);
		tabBrowser.addProgressListener(NetProgressListener);
		tabBrowser.tabContainer.addEventListener("TabOpen", NetProgressListener, false);
		tabBrowser.tabContainer.addEventListener("TabClose", NetProgressListener, false);
		tabBrowser.tabContainer.addEventListener("TabSelect", NetProgressListener, false);
	} else {
		// works in mobile FF
		tabBrowser.deck.addEventListener("TabOpen", NetProgressListener, false);
		tabBrowser.deck.addEventListener("TabClose", NetProgressListener, false);
		tabBrowser.deck.addEventListener("TabSelect", NetProgressListener, false);
	}
}

function now()
{
	return (new Date()).getTime();
}

exports.StartNetProgressListen = StartNetProgressListen;
