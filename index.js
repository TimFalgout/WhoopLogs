const express = require("express");
const fs = require("fs");
const path = require("path");
const fastcsv = require("fast-csv");
const dotenv = require('dotenv');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Require and configure dotenv at the top of your file
require('dotenv').config();


const pool = new Pool({
  user: process.env.DB_USER,       // 'postgres'
  host: process.env.DB_HOST,       // 'localhost'
  database: process.env.DB_NAME,   // 'world'
  password: process.env.DB_PASSWORD, // '1585'
  port: process.env.DB_PORT,       // 5433
});

app.get("/", (req, res) => {
  res.render("index");
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));

// Formatting duration
function formatDuration(interval) {
  const hours = interval.hours || 0;
  const minutes = interval.minutes || 0;
  const seconds = interval.seconds || 0;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Function to calculate averages
async function updateAverages() {
  const result = await pool.query("SELECT * FROM exercise_logs");
  const entryLogs = result.rows;

  let durationSum = 0,
    distanceSum = 0,
    paceSum = 0;
  let zone5Sum = 0,
    zone4Sum = 0,
    zone3Sum = 0,
    zone2Sum = 0,
    zone1Sum = 0;
  let avgHrSum = 0,
    maxHrSum = 0,
    strainSum = 0;
  let entryCount = entryLogs.length;

  if (entryCount === 0) {
    return {
      duration_avg: "00:00:00",
      distance_avg: 0,
      pace_avg: 0,
      zone5_avg: 0,
      zone4_avg: 0,
      zone3_avg: 0,
      zone2_avg: 0,
      zone1_avg: 0,
      avg_hr_avg: 0,
      max_hr_avg: 0,
      strain_avg: 0,
    };
  }

  entryLogs.forEach((entry) => {
    const duration = entry.duration || { hours: 0, minutes: 0, seconds: 0 };

    // Convert to numbers explicitly
    const hours = parseInt(duration.hours, 10) || 0;
    const minutes = parseInt(duration.minutes, 10) || 0;
    const seconds = parseInt(duration.seconds, 10) || 0;

    console.log(
      `Numeric values - hours: ${hours}, minutes: ${minutes}, seconds: ${seconds}`
    );

    // Perform the calculation
    let totalSeconds = hours * 3600 + minutes * 60 + seconds;
    durationSum += totalSeconds;

    distanceSum += parseFloat(entry.distance) || 0;
    paceSum += parseFloat(entry.pace) || 0;
    zone5Sum += parseFloat(entry.zone5) || 0;
    zone4Sum += parseFloat(entry.zone4) || 0;
    zone3Sum += parseFloat(entry.zone3) || 0;
    zone2Sum += parseFloat(entry.zone2) || 0;
    zone1Sum += parseFloat(entry.zone1) || 0;
    avgHrSum += parseFloat(entry.avg_hr) || 0;
    maxHrSum += parseFloat(entry.max_hr) || 0;
    strainSum += parseFloat(entry.strain) || 0;
  });

  // Calculate averages
  let durationAvgInSeconds = durationSum / entryCount;
  let distanceAvg = distanceSum / entryCount;
  let paceAvg = paceSum / entryCount;
  let zone5Avg = zone5Sum / entryCount;
  let zone4Avg = zone4Sum / entryCount;
  let zone3Avg = zone3Sum / entryCount;
  let zone2Avg = zone2Sum / entryCount;
  let zone1Avg = zone1Sum / entryCount;
  let avgHrAvg = avgHrSum / entryCount;
  let maxHrAvg = maxHrSum / entryCount;
  let strainAvg = strainSum / entryCount;

  // Convert average duration back to hours, minutes, and seconds
  let avgHours = Math.floor(durationAvgInSeconds / 3600);
  let avgMinutes = Math.floor((durationAvgInSeconds % 3600) / 60);
  let avgSeconds = Math.floor(durationAvgInSeconds % 60);

  let durationAvg = `${avgHours.toString().padStart(2, "0")}:${avgMinutes
    .toString()
    .padStart(2, "0")}:${avgSeconds.toString().padStart(2, "0")}`;

  // Return the averages
  return {
    duration_avg: durationAvg,
    distance_avg: distanceAvg,
    pace_avg: paceAvg,
    zone5_avg: zone5Avg,
    zone4_avg: zone4Avg,
    zone3_avg: zone3Avg,
    zone2_avg: zone2Avg,
    zone1_avg: zone1Avg,
    avg_hr_avg: avgHrAvg,
    max_hr_avg: maxHrAvg,
    strain_avg: strainAvg,
  };
}

// Perform form submission and update averages
app.post("/submit", async (req, res) => {
  let date = req.body.formDate;
  let description = req.body.formDescription;
  let hours = req.body.formHours || 0;
  let minutes = req.body.formMinutes || 0;
  let seconds = req.body.formSeconds || 0;
  let distance = req.body.formDistance;
  let pace = req.body.formPace;
  let zone5 = req.body.form5;
  let zone4 = req.body.form4;
  let zone3 = req.body.form3;
  let zone2 = req.body.form2;
  let zone1 = req.body.form1;
  let avgHr = req.body.formAvgHr;
  let maxHr = req.body.formMaxHr;
  let strain = req.body.formStrain;

  // Create a duration string in HH:MM:SS format
  let duration = `${hours}:${minutes}:${seconds}`;

  try {
    // Insert into the exercise_logs table
    await pool.query(
      `INSERT INTO exercise_logs (date, description, duration, distance, pace, zone5, zone4, zone3, zone2, zone1, avg_hr, max_hr, strain)
            VALUES ($1, $2, $3::interval, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        date,
        description,
        duration,
        distance,
        pace,
        zone5,
        zone4,
        zone3,
        zone2,
        zone1,
        avgHr,
        maxHr,
        strain,
      ]
    );

    // Calculate and insert averages into exercise_averages table
    const averages = await updateAverages();

    await pool.query(
      `INSERT INTO exercise_averages 
        (duration_avg, distance_avg, pace_avg, zone5_avg, zone4_avg, zone3_avg, zone2_avg, zone1_avg, avg_hr_avg, max_hr_avg, strain_avg)
       VALUES 
        ($1::interval, ROUND(CAST($2 AS numeric), 2), ROUND(CAST($3 AS numeric), 2), ROUND(CAST($4 AS numeric), 2), ROUND(CAST($5 AS numeric), 2), ROUND(CAST($6 AS numeric), 2), ROUND(CAST($7 AS numeric), 2), ROUND(CAST($8 AS numeric), 2), ROUND(CAST($9 AS numeric), 2), ROUND(CAST($10 AS numeric), 2), ROUND(CAST($11 AS numeric), 2))`,
      [
        averages.duration_avg,
        averages.distance_avg,
        averages.pace_avg,
        averages.zone5_avg,
        averages.zone4_avg,
        averages.zone3_avg,
        averages.zone2_avg,
        averages.zone1_avg,
        averages.avg_hr_avg,
        averages.max_hr_avg,
        averages.strain_avg,
      ]
    );

    res.redirect("/logs");
  } catch (err) {
    console.error("Error inserting data: ", err);
    res.status(500).send("Internal Server Error");
  }
});

// Fetch logs and latest averages for logs.ejs
app.get("/logs", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM exercise_logs ORDER BY date DESC"
    );
    const entryLogs = result.rows;

    // Format duration for display
    entryLogs.forEach((entry) => {
      entry.duration = formatDuration(entry.duration); // Format duration
    });

    // Fetch the latest averages
    const averagesResult = await pool.query(
      "SELECT * FROM exercise_averages ORDER BY id DESC LIMIT 1"
    );
    const averages = averagesResult.rows[0] || {}; // Use the latest averages or an empty object

    res.render("logs", {
      entryLogs: entryLogs,
      duration_avg: averages.duration_avg || "N/A",
      distance_avg: averages.distance_avg || "N/A",
      pace_avg: averages.pace_avg || "N/A",
      zone5_avg: averages.zone5_avg || "N/A",
      zone4_avg: averages.zone4_avg || "N/A",
      zone3_avg: averages.zone3_avg || "N/A",
      zone2_avg: averages.zone2_avg || "N/A",
      zone1_avg: averages.zone1_avg || "N/A",
      avg_hr_avg: averages.avg_hr_avg || "N/A",
      max_hr_avg: averages.max_hr_avg || "N/A",
      strain_avg: averages.strain_avg || "N/A",
    });
  } catch (err) {
    console.error("Error inserting data: ", err);
    console.error("Error details: ", err.stack);
    console.error("Attempted values: ", averages);
    res.status(500).send("Internal Server Error");
  }
});

// Export logs to CSV and archive them to zip file using node-csv package and npm archiver package

// Route to export both tables as CSV and serve as a zip file
app.get("/export-both", async (req, res) => {
  const logFilePath = path.join(__dirname, "exercise_logs.csv");
  const avgFilePath = path.join(__dirname, "exercise_averages.csv");

  try {
    // Query data from the exercise_logs table
    const logsResult = await pool.query("SELECT * FROM exercise_logs");
    const logsData = logsResult.rows;

    // Write exercise_logs data to CSV using fast-csv
    const logsStream = fs.createWriteStream(logFilePath);
    fastcsv
      .write(logsData, { headers: true })
      .pipe(logsStream)
      .on("finish", async () => {
        // After logs CSV is written, query and write the exercise_averages data
        const averagesResult = await pool.query(
          "SELECT * FROM exercise_averages"
        );
        const averagesData = averagesResult.rows;

        const avgStream = fs.createWriteStream(avgFilePath);
        fastcsv
          .write(averagesData, { headers: true })
          .pipe(avgStream)
          .on("finish", () => {
            // Create a zip file after both CSVs are written
            const zipFilePath = path.join(__dirname, "workouts.zip");
            const output = fs.createWriteStream(zipFilePath);
            const archiver = require("archiver");

            const archive = archiver("zip", { zlib: { level: 9 } });
            output.on("close", () => {
              res.download(zipFilePath, "workouts.zip", (err) => {
                if (err) {
                  console.log("Error sending file:", err);
                }

                // Optionally clean up the files afterward
                fs.unlinkSync(logFilePath);
                fs.unlinkSync(avgFilePath);
                fs.unlinkSync(zipFilePath);
              });
            });

            archive.pipe(output);
            archive.file(logFilePath, { name: "exercise_logs.csv" });
            archive.file(avgFilePath, { name: "exercise_averages.csv" });
            archive.finalize();
          });
      });
  } catch (err) {
    console.error("Error exporting data:", err);
    res.status(500).send("Error exporting data");
  }
});

// Route to clear both tables
app.post("/delete-both", async (req, res) => {
  try {
    // Truncate (clear) the exercise_logs table
    await pool.query("TRUNCATE TABLE exercise_logs RESTART IDENTITY");
    // Truncate (clear) the exercise_averages table
    await pool.query("TRUNCATE TABLE exercise_averages RESTART IDENTITY");

    res.redirect("/");
  } catch (err) {
    console.error("Error clearing data:", err);
    res.status(500).send("Error clearing data");
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
