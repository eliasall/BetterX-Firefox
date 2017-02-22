//	www.betterX.org
//	elias allayiotis

const {Cu} = require("chrome");
const Utils = Cu.import("resource://gre/modules/FileUtils.jsm", {}).FileUtils;

var tabsDataWriter = require("./TabsDataWriter.js");
var infoDataWriter = require("./InfoDataWriter.js");
var webDataWriter = require("./WebDataWriter.js");

var LogTypes = Object.freeze({Tabs: 0, Info: 1, Web: 2, Perf: 3, Screen: 4, Interact:5});
var path;

// Get Downloads directory path which is accessable for both FF and user
function GetWritableDir()
{
	var dir = Utils.getDir("DfltDwnld", ["BetterX"], true);	// use Downloads directory
	//var dir = Utils.getDir("ProfD", ["BetterX"], true);	// use Firefox Profile directory
	path = dir.path;
}

// Call different writer depends on data type
function SaveLogData(data, type)
{
	if (path) {
		
		switch(type) {
		case LogTypes.Tabs:
			tabsDataWriter.SaveLogDataTabs(data, path);
			break;
		case LogTypes.Info:
			infoDataWriter.SaveLogDataInfo(data, path);
			break;
		case LogTypes.Web:
			webDataWriter.SaveLogDataWeb(data, path);
			break;
		}
	}
}

exports.GetWritableDir = GetWritableDir;
exports.SaveLogData = SaveLogData;
exports.LogTypes = LogTypes;
