let isFaceDetected = false;
let isLocationVerified = false;
let isOpenCvLoaded = false;
let isCameraRunning = false;
let verificationStartTime = null;
let test = true;

// Will be called by OpenCV script tag onload
function onOpenCvReady() {
    console.log('OpenCV.js is ready.');
    isOpenCvLoaded = true;
    if (window.location.pathname.includes('mark-attendance.html')) {
        initCamera();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';

    // Protect routes
    const user = JSON.parse(localStorage.getItem('smart_user'));
    if (!user && page !== 'login.html') {
        window.location.href = 'login.html';
        return;
    }

    if (page === 'login.html') {
        initLogin();
    } else {
        updateUserInfo(user);
    }

    if (page === 'mark-attendance.html') {
        // initCamera is called when OpenCV is ready
        initMap();
    }
});

function initLogin() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('error-msg');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            if (result.success) {
                localStorage.setItem('smart_user', JSON.stringify(result.user));
                window.location.href = 'index.html';
            } else {
                errorMsg.innerText = result.message;
                errorMsg.style.display = 'block';
            }
        } catch (err) {
            errorMsg.innerText = "Network error. Please try again later.";
            errorMsg.style.display = 'block';
        }
    });
}

function updateUserInfo(user) {
    if (!user) return;
    const userNameElements = document.querySelectorAll('.user-profile span');
    const userAvatarElements = document.querySelectorAll('.user-profile .avatar');
    const welcomeHeader = document.querySelector('.welcome-text h1');

    const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2);

    if (welcomeHeader) welcomeHeader.innerText = `Welcome back, ${user.name.split(' ')[0]}!`;
    
    userNameElements.forEach(el => el.innerText = user.name);
    userAvatarElements.forEach(el => el.innerText = initials);

    // Setup logout hooks
    const logoutLinks = document.querySelectorAll('a[href="#"]');
    logoutLinks.forEach(link => {
        if (link.innerText.trim() === 'Logout') {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('smart_user');
                window.location.href = 'login.html';
            });
        }
    });
}

// Helper to create a file in OpenCV's virtual file system
async function loadCascade() {
    try {
        const response = await fetch('models/haarcascade_frontalface_default.xml');
        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);
        cv.FS_createDataFile('/', 'haarcascade_frontalface_default.xml', data, true, false, false);
        console.log("Cascade loaded into virtual FS.");
        return true;
    } catch (error) {
        console.error("Error loading cascade:", error);
        return false;
    }
}

async function initCamera() {
    if (isCameraRunning) return;
    isCameraRunning = true;
    
    const videoElement = document.getElementById('camera-feed');
    const loadingText = document.getElementById('camera-loading');

    if (!videoElement) {
        if (loadingText) loadingText.innerText = "Error: Video element missing.";
        return;
    }
    const container = videoElement.parentElement;

    if (!isOpenCvLoaded) {
        if (loadingText) loadingText.innerText = "Waiting for OpenCV to load...";
        return;
    }

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (loadingText) loadingText.innerText = "Camera API blocked (HTTPS or localhost required).";
            alert("Camera access is blocked. You MUST use 'http://localhost:5000' or 'http://127.0.0.1:5000' to test the camera locally without HTTPS. If you are using an IP address (e.g. 192.x), the browser will permanently block the camera.");
            return;
        }

        // Load cascade
        const loaded = await loadCascade();
        if (!loaded) {
            if (loadingText) loadingText.innerText = "Error: Failed to load AI model.";
            return;
        }

        // Request camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoElement.srcObject = stream;
        videoElement.play();

        videoElement.addEventListener('playing', () => {
            if (loadingText) loadingText.style.display = 'none';
            videoElement.style.opacity = '1';
            verificationStartTime = Date.now();

            // Remove old canvas if exists
            const oldOverlay = container.querySelector('.camera-overlay');
            if (oldOverlay) {
                oldOverlay.style.display = 'block';
                oldOverlay.remove();
            }
                
                let canvas = container.querySelector('canvas');
                if (!canvas) {
                    canvas = document.createElement('canvas');
                    canvas.style.position = 'absolute';
                    canvas.style.top = '0';
                    canvas.style.left = '0';
                    canvas.width = videoElement.videoWidth || 640;
                    canvas.height = videoElement.videoHeight || 480;
                    container.style.position = 'relative';
                    container.appendChild(canvas);
                }

                const displaySize = { width: canvas.width, height: canvas.height };

                let cap;
                let src;
                let gray;
                let faceCascade;

                function initializeOpencvVariables() {
                    const width = videoElement.videoWidth;
                    const height = videoElement.videoHeight;
                    if (width === 0 || height === 0) return false;

                    canvas.width = width;
                    canvas.height = height;
                    displaySize.width = width;
                    displaySize.height = height;

                    src = new cv.Mat(height, width, cv.CV_8UC4);
                    gray = new cv.Mat(height, width, cv.CV_8UC1);
                    cap = new cv.VideoCapture(videoElement);
                    faceCascade = new cv.CascadeClassifier();
                    faceCascade.load('haarcascade_frontalface_default.xml');
                    return true;
                }
                
                const FPS = 15; // Limit FPS to avoid freezing
                let isInitialized = false;

                function processVideo() {
                    try {
                        if (!videoElement || !videoElement.srcObject) {
                            if (isInitialized) {
                                if (src) src.delete(); 
                                if (gray) gray.delete(); 
                                if (faceCascade) faceCascade.delete();
                                isInitialized = false;
                            }
                            return;
                        }

                        // Wait for video dimensions to be ready
                        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
                            requestAnimationFrame(processVideo);
                            return;
                        }

                        if (!isInitialized) {
                            isInitialized = initializeOpencvVariables();
                            if (!isInitialized) {
                                requestAnimationFrame(processVideo);
                                return;
                            }
                        }

                        // Ensure matrices match current video dimensions
                        if (!src || src.cols !== videoElement.videoWidth || src.rows !== videoElement.videoHeight) {
                            if (src) src.delete();
                            if (gray) gray.delete();
                            if (cap) cap = null; // Prepare to re-init cap
                            
                            src = new cv.Mat(videoElement.videoHeight, videoElement.videoWidth, cv.CV_8UC4);
                            gray = new cv.Mat(videoElement.videoHeight, videoElement.videoWidth, cv.CV_8UC1);
                            cap = new cv.VideoCapture(videoElement);
                            
                            canvas.width = videoElement.videoWidth;
                            canvas.height = videoElement.videoHeight;
                            console.log(`OpenCV Resized: ${canvas.width}x${canvas.height}`);
                        }

                        cap.read(src);
                        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
                        
                        let faces = new cv.RectVector();
                        let msize = new cv.Size(0, 0);
                        faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0, msize, msize);
                        
                        isFaceDetected = faces.size() > 0;
                        
                        for (let i = 0; i < faces.size(); ++i) {
                            let face = faces.get(i);
                            let point1 = new cv.Point(face.x, face.y);
                            let point2 = new cv.Point(face.x + face.width, face.y + face.height);
                            cv.rectangle(src, point1, point2, [0, 255, 0, 255], 2);
                        }
                        
                        cv.imshow(canvas, src);
                        faces.delete();

                        setTimeout(processVideo, 1000 / FPS);
                    } catch (err) {
                        console.error("OpenCV Processing Error:", err);
                        // If we see the 'Bad size' error, force a cleanup and retry
                        if (isInitialized) {
                            if (src) src.delete();
                            if (gray) gray.delete();
                            isInitialized = false;
                        }
                        setTimeout(processVideo, 500);
                    }
                }

                // Start processing after a brief delay to ensure video frames are available
                setTimeout(processVideo, 500); 
            }, { once: true });

    } catch (err) {
        console.error("Camera access denied or error:", err);
        if (loadingText) loadingText.innerText = "Error: " + err.message;
        alert("Could not access the camera. Please make sure you granted Camera permissions in your browser and no other application is currently using it.\n\nError: " + err.message);
    }
}

let CAMPUS_COORDS = null; // Will set on first load for demo purposes
const ALLOWED_RADIUS = 50; // meters

function initMap() {
    const mapText = document.getElementById('map-text');
    const locationText = document.getElementById('location-text');
    const locationStatus = document.getElementById('location-status');

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // For demo, we set campus coords to the first fetched location
                if (!CAMPUS_COORDS) {
                    CAMPUS_COORDS = { lat, lng };
                }

                const distance = calculateDistance(lat, lng, CAMPUS_COORDS.lat, CAMPUS_COORDS.lng);
                
                if (mapText) {
                    mapText.innerHTML = `<strong>Campus Mock Coords:</strong><br>${CAMPUS_COORDS.lat.toFixed(5)}, ${CAMPUS_COORDS.lng.toFixed(5)}<br><br><strong>Current Distance:</strong> ${Math.round(distance)}m`;
                }
                if (locationText) {
                    locationText.innerText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                }

                if (locationStatus) {
                    if (distance <= ALLOWED_RADIUS) {
                        isLocationVerified = true;
                        locationStatus.innerHTML = '✔ Within Campus Radius';
                        locationStatus.style.color = '#00b894';
                    } else {
                        isLocationVerified = false;
                        locationStatus.innerHTML = '✖ Outside Campus Radius';
                        locationStatus.style.color = '#d63031';
                    }
                }
            },
            (error) => {
                console.error("Error getting location: ", error);
                if (mapText) mapText.innerHTML = "Location access denied or unavailable.";
                if (locationStatus) {
                    locationStatus.innerHTML = "✖ Location Error";
                    locationStatus.style.color = '#d63031';
                }
            },
            { enableHighAccuracy: true }
        );
    } else {
        if (mapText) mapText.innerHTML = "Geolocation is not supported by this browser.";
    }
}

// Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
}

function verifyAttendance() {
    const btn = document.getElementById('verify-btn');
    const status = document.getElementById('verification-status');
    const mapText = document.getElementById('map-text');
    const locationText = document.getElementById('location-text');

    if (!btn || !status) return;

    btn.innerHTML = 'Verifying...';
    btn.disabled = true;
    status.style.display = 'block';
    status.innerHTML = 'Starting verification...';

    const timeSpent = verificationStartTime ? (Date.now() - verificationStartTime) / 1000 : 0;
    
    setTimeout(async () => {
        let proceed = false;
        
        if (isFaceDetected && isLocationVerified) {
            proceed = true;
        } else if (isLocationVerified && timeSpent >= 15) {
            if (confirm("AI face detection is taking longer than usual. Proceed with manual verification?")) {
                proceed = true;
            }
        } else if (!isLocationVerified) {
            btn.innerHTML = 'Verify & Mark Attendance';
            btn.disabled = false;
            status.innerHTML = '<span style="color: #d63031; font-weight: bold;">✖ Verification Failed: You must be within the campus radius.</span>';
            return;
        } else {
            btn.innerHTML = 'Verify & Mark Attendance';
            btn.disabled = false;
            status.innerHTML = '<span style="color: #d63031; font-weight: bold;">✖ Face not detected yet. Please wait for the green box.</span>';
            return;
        }

        if (proceed) {
            try {
                const user = JSON.parse(localStorage.getItem('smart_user'));
                const locationStr = locationText ? locationText.innerText : 'Unknown';

                const response = await fetch('/api/mark-attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: user.id,
                        status: 'Present',
                        location: locationStr
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    btn.innerHTML = 'Verified';
                    btn.style.backgroundColor = '#00b894';
                    status.innerHTML = '<span style="color: #00b894; font-weight: bold;">✔ Attendance Marked Successfully</span>';
                } else {
                    throw new Error(result.message);
                }
            } catch (err) {
                btn.innerHTML = 'Verify & Mark Attendance';
                btn.disabled = false;
                status.innerHTML = `<span style="color: #d63031; font-weight: bold;">✖ Server Error: ${err.message || 'Verification Failed'}</span>`;
            }
        }
    }, 1000);
}
