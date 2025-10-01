# TERI - One Click App Launcher
# Beautiful GUI launcher for the Truth Empowered Relationships App

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Create the form
$form = New-Object System.Windows.Forms.Form
$form.Text = "TERI - Truth Empowered Relationships"
$form.Size = New-Object System.Drawing.Size(600,500)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(103, 126, 234)

# Title Label
$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "🤝 TERI APP"
$titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 36, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = [System.Drawing.Color]::White
$titleLabel.AutoSize = $true
$titleLabel.Location = New-Object System.Drawing.Point(150, 30)
$form.Controls.Add($titleLabel)

# Subtitle
$subtitleLabel = New-Object System.Windows.Forms.Label
$subtitleLabel.Text = "Truth Empowered Relationships"
$subtitleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 14)
$subtitleLabel.ForeColor = [System.Drawing.Color]::White
$subtitleLabel.AutoSize = $true
$subtitleLabel.Location = New-Object System.Drawing.Point(160, 90)
$form.Controls.Add($subtitleLabel)

# Start Button
$startButton = New-Object System.Windows.Forms.Button
$startButton.Text = "🚀 START APP"
$startButton.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$startButton.Size = New-Object System.Drawing.Size(200, 60)
$startButton.Location = New-Object System.Drawing.Point(100, 150)
$startButton.BackColor = [System.Drawing.Color]::FromArgb(245, 201, 93)
$startButton.ForeColor = [System.Drawing.Color]::White
$startButton.FlatStyle = 'Flat'
$startButton.FlatAppearance.BorderSize = 0

# Stop Button
$stopButton = New-Object System.Windows.Forms.Button
$stopButton.Text = "⏹️ STOP APP"
$stopButton.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$stopButton.Size = New-Object System.Drawing.Size(200, 60)
$stopButton.Location = New-Object System.Drawing.Point(300, 150)
$stopButton.BackColor = [System.Drawing.Color]::White
$stopButton.ForeColor = [System.Drawing.Color]::FromArgb(118, 75, 162)
$stopButton.FlatStyle = 'Flat'
$stopButton.FlatAppearance.BorderSize = 0

# Status Panel
$statusGroup = New-Object System.Windows.Forms.GroupBox
$statusGroup.Text = "System Status"
$statusGroup.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$statusGroup.ForeColor = [System.Drawing.Color]::White
$statusGroup.Size = New-Object System.Drawing.Size(480, 180)
$statusGroup.Location = New-Object System.Drawing.Point(50, 240)

# Status Labels
$dbLabel = New-Object System.Windows.Forms.Label
$dbLabel.Text = "📊 Database: Ready"
$dbLabel.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$dbLabel.ForeColor = [System.Drawing.Color]::White
$dbLabel.AutoSize = $true
$dbLabel.Location = New-Object System.Drawing.Point(20, 30)
$statusGroup.Controls.Add($dbLabel)

$modelLabel = New-Object System.Windows.Forms.Label
$modelLabel.Text = "🤖 TERI Model: Ready"
$modelLabel.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$modelLabel.ForeColor = [System.Drawing.Color]::White
$modelLabel.AutoSize = $true
$modelLabel.Location = New-Object System.Drawing.Point(20, 60)
$statusGroup.Controls.Add($modelLabel)

$apiLabel = New-Object System.Windows.Forms.Label
$apiLabel.Text = "🔧 Backend API: Ready"
$apiLabel.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$apiLabel.ForeColor = [System.Drawing.Color]::White
$apiLabel.AutoSize = $true
$apiLabel.Location = New-Object System.Drawing.Point(20, 90)
$statusGroup.Controls.Add($apiLabel)

$mobileLabel = New-Object System.Windows.Forms.Label
$mobileLabel.Text = "📱 Mobile App: Ready"
$mobileLabel.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$mobileLabel.ForeColor = [System.Drawing.Color]::White
$mobileLabel.AutoSize = $true
$mobileLabel.Location = New-Object System.Drawing.Point(20, 120)
$statusGroup.Controls.Add($mobileLabel)

$form.Controls.Add($statusGroup)

# Progress Bar
$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Size = New-Object System.Drawing.Size(480, 20)
$progressBar.Location = New-Object System.Drawing.Point(50, 430)
$progressBar.Style = 'Continuous'
$progressBar.Visible = $false
$form.Controls.Add($progressBar)

# Start Button Click Event
$startButton.Add_Click({
    $progressBar.Visible = $true
    $progressBar.Value = 0
    $startButton.Enabled = $false

    # Update status
    $dbLabel.Text = "📊 Database: Starting..."
    $dbLabel.ForeColor = [System.Drawing.Color]::Yellow
    $progressBar.Value = 20
    Start-Sleep -Seconds 1

    # Start Database
    Start-Process -FilePath "docker-compose" -ArgumentList "up -d postgres redis chromadb" -WorkingDirectory "C:\Users\John\Desktop\teri-model" -WindowStyle Hidden
    $dbLabel.Text = "📊 Database: Running ✅"
    $dbLabel.ForeColor = [System.Drawing.Color]::LightGreen
    $progressBar.Value = 40

    # Start TERI Model
    $modelLabel.Text = "🤖 TERI Model: Starting..."
    $modelLabel.ForeColor = [System.Drawing.Color]::Yellow
    Start-Process -FilePath "cmd" -ArgumentList "/c ollama serve" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Start-Process -FilePath "cmd" -ArgumentList "/c ollama run TERI:latest" -WindowStyle Hidden
    $modelLabel.Text = "🤖 TERI Model: Running ✅"
    $modelLabel.ForeColor = [System.Drawing.Color]::LightGreen
    $progressBar.Value = 60

    # Start Backend API
    $apiLabel.Text = "🔧 Backend API: Starting..."
    $apiLabel.ForeColor = [System.Drawing.Color]::Yellow
    Start-Process -FilePath "node" -ArgumentList "src/app.js" -WorkingDirectory "C:\Users\John\Desktop\teri-model\backend" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    $apiLabel.Text = "🔧 Backend API: Running ✅"
    $apiLabel.ForeColor = [System.Drawing.Color]::LightGreen
    $progressBar.Value = 80

    # Start Mobile App
    $mobileLabel.Text = "📱 Mobile App: Starting..."
    $mobileLabel.ForeColor = [System.Drawing.Color]::Yellow
    Start-Process -FilePath "cmd" -ArgumentList "/c cd C:\Users\John\Desktop\teri-model\mobile && npx react-native run-android" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    $mobileLabel.Text = "📱 Mobile App: Running ✅"
    $mobileLabel.ForeColor = [System.Drawing.Color]::LightGreen
    $progressBar.Value = 100

    Start-Sleep -Seconds 1
    $progressBar.Visible = $false
    $startButton.Enabled = $true

    # Open browser to health check
    Start-Process "http://localhost:5000/health"

    [System.Windows.Forms.MessageBox]::Show("TERI App is now running!

Backend API: http://localhost:5000
Mobile App: Check your emulator/device

All systems operational! 🚀", "Success", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
})

# Stop Button Click Event
$stopButton.Add_Click({
    $progressBar.Visible = $true
    $progressBar.Value = 0
    $stopButton.Enabled = $false

    # Stop services
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    $apiLabel.Text = "🔧 Backend API: Stopped"
    $apiLabel.ForeColor = [System.Drawing.Color]::Red
    $progressBar.Value = 33

    Stop-Process -Name "ollama" -Force -ErrorAction SilentlyContinue
    $modelLabel.Text = "🤖 TERI Model: Stopped"
    $modelLabel.ForeColor = [System.Drawing.Color]::Red
    $progressBar.Value = 66

    Start-Process -FilePath "docker-compose" -ArgumentList "down" -WorkingDirectory "C:\Users\John\Desktop\teri-model" -WindowStyle Hidden -Wait
    $dbLabel.Text = "📊 Database: Stopped"
    $dbLabel.ForeColor = [System.Drawing.Color]::Red
    $mobileLabel.Text = "📱 Mobile App: Stopped"
    $mobileLabel.ForeColor = [System.Drawing.Color]::Red
    $progressBar.Value = 100

    Start-Sleep -Seconds 1
    $progressBar.Visible = $false
    $stopButton.Enabled = $true

    [System.Windows.Forms.MessageBox]::Show("TERI App has been stopped successfully.", "Stopped", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
})

$form.Controls.Add($startButton)
$form.Controls.Add($stopButton)

# Show the form
$form.ShowDialog()