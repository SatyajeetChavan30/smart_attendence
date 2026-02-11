document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.split('/').pop();

    if (page === 'mark-attendance.html') {
        initCamera();
        initMap();
    }
});

function initCamera() {
    const videoElement = document.getElementById('camera-feed');
    if (videoElement) {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    videoElement.srcObject = stream;
                })
                .catch(err => {
                    console.error("Camera access denied", err);
                });
        }
    }
}

function initMap() {
    // Mock map initialization
}

function verifyAttendance() {
    const btn = document.getElementById('verify-btn');
    const status = document.getElementById('verification-status');

    btn.innerHTML = 'Verifying...';
    btn.disabled = true;

    setTimeout(() => {
        btn.innerHTML = 'Verified';
        btn.style.backgroundColor = '#00b894';
        status.innerHTML = '<span style="color: #00b894; font-weight: bold;">✔ Attendance Marked Successfully</span>';
        status.style.display = 'block';
    }, 2000);
}
