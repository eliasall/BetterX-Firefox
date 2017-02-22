//	www.betterX.org
//	elias allayiotis

// Helper functions to work with FF tabs, window Objects and tab browser
// Based on \furebug\content\firebug\chrome\window.js

const {Cc, Ci} = require("chrome");
var writableDir = require("./WritableDir.js");

function GetWindowForRequest(request)
{
    var loadContext = GetRequestLoadContext(request);
    if (loadContext) {
		try {
			return loadContext.associatedWindow;
		} catch (ex) {
			//console.log(ex);
		}
	}

    return null;
};
	
function GetRequestLoadContext(request)
{
    try
    {
        if (request && request.notificationCallbacks)
        {
            return request.notificationCallbacks.getInterface(Ci.nsILoadContext);
        }
    }
    catch (exc) { }

    try
    {
        if (request && request.loadGroup && request.loadGroup.notificationCallbacks)
        {
            return request.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);
        }
    }
    catch (exc) { }

    return null;
};

function GetRootWindow(win)
{
    for (; win; win = win.parent)
    {
        if (!win.parent || win == win.parent)
            return win;

        // When checking the 'win.parent' type we need to use the target
        // type from the same scope. i.e. from win.parent
        // Iframes from different domains can use different Window type than
        // the top level window.
        if (!(win.parent instanceof win.parent.Window))
            return win;
    }

    return null;
};

function getTabBrowser()
{
	var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Ci.nsIWindowMediator);
	var mainWindow = wm.getMostRecentWindow("navigator:browser");
	
	if (mainWindow && mainWindow.BrowserApp) {
		return mainWindow.BrowserApp;
	} else if (mainWindow && mainWindow.gBrowser) {
		return mainWindow.gBrowser;
	}

	return null;
}

function GetTabForWindow(aWindow)
{
    aWindow = GetRootWindow(aWindow);

    var tabBrowser = getTabBrowser();
    if (!aWindow || !tabBrowser || !tabBrowser.getBrowserIndexForDocument)
    {
        return null;
    }

    try
    {
        var targetDoc = aWindow.document;

        var tab = null;
        var targetBrowserIndex = tabBrowser.getBrowserIndexForDocument(targetDoc);
        if (targetBrowserIndex != -1)
        {
            tab = tabBrowser.tabContainer.childNodes[targetBrowserIndex];
            return tab;
        }
    }
    catch (ex)
    {
    }

    return null;
};

function GetTabIdForWindow(win)
{
    var tab = win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils).outerWindowID;
	
	if (!tab) {
		tab = GetTabForWindow(win);
		return tab ? tab.linkedPanel : null;
	} else {
		return tab;
	}
};

function GetBrowserByWindow(win)
{
    var browsers = getTabBrowser();
	
	if (browsers) {
		for (var i = 0; i < browsers.length; ++i)
		{
			var browser = browsers[i];
			if (browser.contentWindow === win)
				return browser;
		}
	}

    return null;
};

function GetTabIdFromEvent(ev)
{
	// for mobile
	var win = ev.target.contentWindow;
	
	// for desktop
	if (!win) {
		win = ev.target.linkedBrowser.contentWindow;
	}
	
	if (win instanceof Ci.nsIDOMWindow) {

		var tabid = GetTabIdForWindow(win);

		if (tabid) {
			return tabid;
		}
	}
	
	return null;
}
				
exports.GetTabIdForWindow = GetTabIdForWindow;
exports.GetWindowForRequest = GetWindowForRequest;
exports.GetBrowserByWindow = GetBrowserByWindow;
exports.GetTabIdFromEvent = GetTabIdFromEvent;
exports.getTabBrowser = getTabBrowser;