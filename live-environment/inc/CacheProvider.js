//	www.betterX.org
//	elias allayiotis

const {Cc, Ci, Cu} = require("chrome");

const cache = Cc["@mozilla.org/netwerk/cache-storage-service;1"].getService(Ci.nsICacheStorageService);
var {LoadContextInfo} = Cu.import("resource://gre/modules/LoadContextInfo.jsm", null);
// Work with cache, async functions.
// Based on https://developer.mozilla.org/en-US/docs/HTTP_Cache


//const cons = Cu.import("resource://gre/modules/devtools/Console.jsm", {}).console;

var storage = cache.diskCacheStorage(LoadContextInfo.default, false);

function makeURI(aURL) {
  var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  return ioService.newURI(aURL, null, null);
}

// Get number of cache elements in local browser cache
function GetCacheEntriesNumber(callback) {

	Visitor.prototype = {
		
		onCacheStorageInfo: function(num, consumption)
		{
			callback(num);
		},
		
		// not called
		onCacheEntryInfo: function(aURI, aIdEnhance, aDataSize, aFetchCount) { },
		
		onCacheEntryVisitCompleted: function() { }
	};
	function Visitor() {}
		
	storage.asyncVisitStorage(new Visitor(), false /* Do not walk entries */);
}

// Get the number of times the cache entry has been opened
function GetCacheEntrieHitCount(callback, href) {

	try{
		storage.asyncOpenURI(
			makeURI(href),
			"",
			Ci.nsICacheStorage.OPEN_NORMALLY,
			{
				onCacheEntryCheck: function (entry, appcache)
				{
					callback(entry.fetchCount);
					return Ci.nsICacheEntryOpenCallback.ENTRY_NOT_WANTED;
				},
				
				// not called because of ENTRY_NOT_WANTED
				onCacheEntryAvailable: function (entry, isnew, appcache, status) { }
			}
		);
	} catch (e) {
		//cons.log(e.message);
	}
}

exports.GetCacheEntriesNumber = GetCacheEntriesNumber;
exports.GetCacheEntrieHitCount = GetCacheEntrieHitCount;

