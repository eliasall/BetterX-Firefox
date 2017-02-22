//	www.betterX.org
//	elias allayiotis

// Get current date in format 'mmddyyy'
function GetFormatedDate() 
{
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth()+1; //January is 0!
	var yyyy = today.getFullYear();

	if(dd<10) {
		dd = '0' + dd.toString();
	} 

	if(mm<10) {
		mm = '0' + mm.toString();
	} 

	return dd.toString() + mm.toString() + yyyy.toString();
}

exports.GetFormatedDate = GetFormatedDate;
