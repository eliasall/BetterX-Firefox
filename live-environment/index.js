//	www.betterX.org
//	elias allayiotis

const {Cu} = require("chrome");
//const cons = Cu.import("resource://gre/modules/devtools/Console.jsm", {}).console;

var writableDir = require("./inc/WritableDir.js");
var LogTypes = writableDir.LogTypes;

var NetMonitor = require("./inc/NetMonitor.js");
var ProgressListener = require("./inc/NetProgressListener.js");
const VERSION = "0.0.6";

// get and save directory path where log files will be stored
writableDir.GetWritableDir();
// start web data logging
NetMonitor.RegisterObservers();
// start listening for events: 'TabOpen', 'TabClose', 'TabSelect', 'DOMContentLoaded' and 'load'
ProgressListener.StartNetProgressListen();

exports.main = function (options, callbacks)
{
	var loadReason = options.loadReason;

	// write version info only when addon is installed or upgraded
	if (loadReason == "install" || loadReason == "upgrade") {
		writableDir.SaveLogData(VERSION, LogTypes.Info);
	}
};

exports.onUnload = function (reason)
{
	NetMonitor.UnRegisterObservers();
};
