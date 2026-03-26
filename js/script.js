let isFaceVerified = false;
let isLocationVerified = false;
let isFaceApiLoaded = false;
let isCameraRunning = false;
let verificationStartTime = null;
let lastFaceVerifiedTime = 0;

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';

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

    if (page === 'index.html' || page === '') {
        initDashboard(user);
    }

    if (page === 'mark-attendance.html') {
        initCamera();
        initMap();
    }

    if (page === 'admin-attendance.html') {
        initAdminScanner();
    }

    if (page === 'history.html') {
        initHistory(user);
    }

    if (page === 'reports.html') {
        initReports(user);
    }
});

async function initDashboard(user) {
    if (!user) return;
    try {
        const response = await fetch(`/api/dashboard-stats?user_id=${user.id}`);
        const result = await response.json();
        if (!result.success) return;

        const cards = document.querySelectorAll('.stat-card');
        if (cards.length >= 1) {
            const pctEl = cards[0].querySelector('.stat-value');
            if (pctEl) pctEl.innerText = result.overall_pct + '%';
        }
        if (cards.length >= 2) {
            const statusEl = cards[1].querySelector('.stat-value');
            if (statusEl) statusEl.innerText = result.today_status;
            const iconEl = cards[1].querySelector('.stat-icon');
            if (iconEl) {
                if (result.today_status === 'Present') { iconEl.innerText = '✔'; iconEl.className = 'stat-icon icon-green'; }
                else if (result.today_status === 'Late') { iconEl.innerText = 'L'; iconEl.className = 'stat-icon icon-orange'; }
                else if (result.today_status === 'Absent') { iconEl.innerText = '✖'; iconEl.className = 'stat-icon icon-red'; }
                else { iconEl.innerText = '—'; iconEl.className = 'stat-icon'; }
            }
        }
        if (cards.length >= 3) {
            const lateEl = cards[2].querySelector('.stat-value');
            if (lateEl) lateEl.innerText = result.late_count;
        }
    } catch (err) {
        console.error('Error loading dashboard stats:', err);
    }
}

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

async function initCamera() {
    if (isCameraRunning) return;
    isCameraRunning = true;
    
    const videoElement = document.getElementById('camera-feed');
    const loadingText = document.getElementById('camera-loading');
    const container = videoElement ? videoElement.parentElement : null;

    if (!videoElement) return;

    let storedDescriptor = null;
    try {
        const user = JSON.parse(localStorage.getItem('smart_user'));
        if (!user.id) {
            loadingText.innerHTML = "Session is stale. Please <a href='login.html' onclick='localStorage.removeItem(\"smart_user\");'>Log Out and Log In Again</a>.";
            return;
        }
        
        const resp = await fetch(`/api/user-descriptor?user_id=${user.id}`);
        const data = await resp.json();
        if (data.success && data.face_descriptor) {
            storedDescriptor = new Float32Array(data.face_descriptor);
        } else {
            loadingText.innerText = "Error: Face signature not found. Please register your face first.";
            return;
        }
    } catch (err) {
        console.error("Descriptor fetch error:", err);
        loadingText.innerText = "Error fetching user descriptor: " + err.message;
        return;
    }

    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        isFaceApiLoaded = true;
    } catch (error) {
        console.error("Error loading face-api models:", error);
        if (loadingText) loadingText.innerText = "Failed to load AI models.";
        return;
    }

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera API blocked");
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoElement.srcObject = stream;
        videoElement.play();

        videoElement.addEventListener('playing', () => {
            if (loadingText) loadingText.style.display = 'none';
            videoElement.style.opacity = '1';
            verificationStartTime = Date.now();

            const oldOverlay = container.querySelector('.camera-overlay');
            if (oldOverlay) oldOverlay.remove();
                
            let canvas = container.querySelector('canvas');
            if (!canvas) {
                canvas = faceapi.createCanvasFromMedia(videoElement);
                canvas.style.position = 'absolute';
                canvas.style.top = '0';
                canvas.style.left = '0';
                container.style.position = 'relative';
                container.appendChild(canvas);
            }

            const displaySize = { width: videoElement.videoWidth || 640, height: videoElement.videoHeight || 480 };
            faceapi.matchDimensions(canvas, displaySize);

            const labeledDescriptor = new faceapi.LabeledFaceDescriptors("User", [storedDescriptor]);
            const faceMatcher = new faceapi.FaceMatcher(labeledDescriptor, 0.5);

            setInterval(async () => {
                if (!videoElement || !videoElement.srcObject) return;

                const detection = await faceapi.detectSingleFace(videoElement).withFaceLandmarks().withFaceDescriptor();
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                let matchesUser = false;

                if (detection) {
                    const resizedDetection = faceapi.resizeResults(detection, displaySize);
                    faceapi.draw.drawDetections(canvas, resizedDetection);

                    const match = faceMatcher.findBestMatch(detection.descriptor);
                    matchesUser = (match.label === "User");

                    if (matchesUser) {
                        lastFaceVerifiedTime = Date.now();
                    }
                }
                
                isFaceVerified = false;
                const cameraBox = container;
                const faceStatusBadge = document.getElementById('face-status');
                const isRecentlyVerified = (Date.now() - lastFaceVerifiedTime) < 500;
                
                if (isRecentlyVerified) {
                    isFaceVerified = true;
                    cameraBox.classList.add('face-detected');
                    if (faceStatusBadge) {
                        faceStatusBadge.innerText = '✔ Identity Verified';
                        faceStatusBadge.className = 'face-status-badge face-status-found';
                    }
                } else if (detection && !matchesUser) {
                    cameraBox.classList.remove('face-detected');
                    if (faceStatusBadge) {
                        faceStatusBadge.innerText = '✖ Identity Mismatch';
                        faceStatusBadge.className = 'face-status-badge';
                        faceStatusBadge.style.background = 'rgba(214, 48, 49, 0.1)';
                        faceStatusBadge.style.color = 'var(--danger)';
                    }
                } else {
                    cameraBox.classList.remove('face-detected');
                    if (faceStatusBadge) {
                        faceStatusBadge.innerText = 'Scanning for face...';
                        faceStatusBadge.className = 'face-status-badge face-status-searching';
                        faceStatusBadge.style.background = '';
                        faceStatusBadge.style.color = '';
                    }
                }
            }, 300);
        }, { once: true });

    } catch (err) {
        console.error("Camera access denied or error:", err);
        if (loadingText) loadingText.innerText = "Error: " + err.message;
        alert("Camera error: " + err.message);
    }
}

let CAMPUS_COORDS = null;
const ALLOWED_RADIUS = 50;

function initMap() {
    const mapText = document.getElementById('map-text');
    const locationText = document.getElementById('location-text');
    const locationStatus = document.getElementById('location-status');

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
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

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
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
        
        if (isFaceVerified && isLocationVerified) {
            proceed = true;
        } else if (isLocationVerified && timeSpent >= 15) {
            if (confirm("Facial recognition is taking longer than usual. Proceed with manual verification?")) {
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

async function initHistory(user) {
    if (!user) return;
    const tableBody = document.querySelector('tbody');
    if (!tableBody) return;

    try {
        const response = await fetch(`/api/attendance-history?user_id=${user.id}`);
        const result = await response.json();

        if (result.success) {
            tableBody.innerHTML = '';
            if (result.history.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No attendance records found.</td></tr>';
                return;
            }

            result.history.forEach(record => {
                const dateObj = new Date(record.timestamp);
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${dateStr}</td>
                    <td>${timeStr}</td>
                    <td>-</td>
                    <td>${record.location}</td>
                    <td><span class="status-badge bg-${record.status.toLowerCase()}">${record.status}</span></td>
                `;
                tableBody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Error loading history:", err);
    }
}

async function initReports(user) {
    if (!user) return;
    
    try {
        const response = await fetch(`/api/attendance-stats?user_id=${user.id}`);
        const result = await response.json();

        if (result.success) {
            const statsContainer = document.querySelector('.stats-grid');
            if (statsContainer) {
                const summaryCard = statsContainer.querySelectorAll('.stat-card')[1];
                if (summaryCard) {
                    const stats = result.stats;
                    const total = stats.Present + stats.Absent + stats.Late || 1;
                    
                    summaryCard.innerHTML = `
                        <h3>Monthly Summary</h3>
                        <div style="margin-top: 20px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                <span>Present</span>
                                <strong>${stats.Present} Days</strong>
                            </div>
                            <div style="width: 100%; height: 8px; background: #eee; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${(stats.Present/total)*100}%; height: 100%; background: #00b894;"></div>
                            </div>

                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; margin-top: 20px;">
                                <span>Absent</span>
                                <strong>${stats.Absent} Days</strong>
                            </div>
                            <div style="width: 100%; height: 8px; background: #eee; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${(stats.Absent/total)*100}%; height: 100%; background: #d63031;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; margin-top: 20px;">
                                <span>Late</span>
                                <strong>${stats.Late} Days</strong>
                            </div>
                            <div style="width: 100%; height: 8px; background: #eee; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${(stats.Late/total)*100}%; height: 100%; background: #fdcb6e;"></div>
                            </div>
                        </div>
                    `;
                }

                const chartContainer = document.querySelector('.chart-container');
                if (chartContainer) {
                    chartContainer.innerHTML = '';
                    result.trend.forEach(item => {
                        const bar = document.createElement('div');
                        bar.className = 'bar';
                        bar.style.height = `${item.value}%`;
                        if (item.value === 0) bar.style.background = '#dfe6e9';
                        else if (item.value < 50) bar.style.background = '#d63031';
                        
                        bar.innerHTML = `<span>${item.day}</span>`;
                        chartContainer.appendChild(bar);
                    });
                }
            }
        }
    } catch (err) {
        console.error("Error loading reports:", err);
    }
}
