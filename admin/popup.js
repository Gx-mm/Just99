document.body.insertAdjacentHTML("beforeend",`

<div id="popup" class="popup-overlay">

<div class="popup-box">

<div id="popupIcon" class="popup-icon popup-info">ℹ️</div>

<div id="popupTitle" class="popup-title">
Title
</div>

<div id="popupMessage" class="popup-message">
Message
</div>

<button class="popup-btn" onclick="closePopup()">
OK
</button>

</div>

</div>

`);

function showPopup(title,message,type="info"){

const icon=document.getElementById("popupIcon");

icon.className="popup-icon";

if(type==="success"){
icon.classList.add("popup-success");
icon.innerHTML="✓";
}

else if(type==="error"){
icon.classList.add("popup-error");
icon.innerHTML="✕";
}

else if(type==="warning"){
icon.classList.add("popup-warning");
icon.innerHTML="!";
}

else{
icon.classList.add("popup-info");
icon.innerHTML="ℹ";
}

document.getElementById("popupTitle").innerText=title;
document.getElementById("popupMessage").innerText=message;

document.getElementById("popup").classList.add("show");

}

function closePopup(){
document.getElementById("popup").classList.remove("show");
}