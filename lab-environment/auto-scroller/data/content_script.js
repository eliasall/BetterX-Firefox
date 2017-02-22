var scrollTimer = null;		//	Whenever there is a change in device motion or device orientation, this timer scrolls window to currentVal.
var currentVal = 0;			//	rotationRate.alpha, angle of device orientation around X-axis
var rotationTimer = null;	//	timer to set currentVal to 0, when device is kept on flat surface, orientation along X-axis is 0
var oppTimer = null;		//	timer of 500ms to set toggle oppTilt flag, when device tilted oppositely from current position.
var oppTilt = false;		//	flag to set when device tilted oppositely from current direction. Resets after 500ms

/*
	devicemotion is working for all android mobiles
	device orientation is not working for Samsung mobiles, as we can't listen to 'deviceorientation' event
*/

if (window.DeviceMotionEvent || window.DeviceOrientationEvent) {
	window.addEventListener('devicemotion', handleMotion, false);
	window.addEventListener('deviceorientation', handleOrientation, false);
	scrollTimer = setInterval(function(){
		var newY;
		newY = scrollY;
		if(currentVal < 0){
			newY -= Math.abs(currentVal);
		} else if(currentVal > 0){
			newY += Math.abs(currentVal);
		}
		window.scrollTo(scrollX,newY);
	},16);
}

/*
	handleMotion handles 'devicemotion' event
	eventData consists of rotationRate, accleration, accelerationRate
	rotationRate has alpha, beta, gamma

	We're using alpha which gives degree of rotation along X-axis, it is constantly updated.

	We're not setting currentVal to alpha when oppTilt is true, which means whenever phone is tilted in opposite direction for first time.

	We're considering alpha value when it is more than or equal to 10, as lesser alpha is negligible to scroll

	currentVal is multiplied by -1, as per logic, when device tilted away from user, window scrolls down.
*/

function handleMotion(eventData){
	if(eventData.rotationRate && eventData.rotationRate.alpha){
		var newVal = Math.round(eventData.rotationRate.alpha);
		newVal = Math.round(newVal/5)*5;
		if(oppTilt){
			return false;
		}
		if(newVal != 0 && Math.abs(newVal) >= 10){
			if((currentVal < 0 && newVal < 0) || (currentVal > 0 && newVal > 0)){
				currentVal = 0;
				if(oppTimer){
					clearTimeout(oppTimer);
					oppTimer = null;
				}
				oppTimer = setTimeout(function(){
					oppTilt = false;
				},500);
				oppTilt = true;
			} else {
				currentVal = -1*newVal;
			}
		}
	}
}

/*
	handleOrientation listens to orientation changes
	when phone's rotation along X-axis near to 0, we're setting currentVal's value to 0. (When phone is kept on flat surface)
*/

function handleOrientation(eventData){
	if(eventData.beta){
		var beta = Math.abs(parseInt(eventData.beta));
		if(beta < 2){
			currentVal  = 0;
		}
	}
}