const chartDom = document.getElementById("main");
const myChart = echarts.init(chartDom);

let WIND_SPEED = [];
let WIND_DIRECTION = [];
let chartData = [];

const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

async function fetchWindData() {
    try {
        const windSpeedResponse = await fetch("data/wind-speed.json");
        const windSpeedData = await windSpeedResponse.json();
        WIND_SPEED = windSpeedData;

        const windDirectionResponse = await fetch("data/wind-direction.json");
        const windDirectionData = await windDirectionResponse.json();
        WIND_DIRECTION = windDirectionData;

        createChart();
    } catch (error) {
        console.error(error);
    }
}

fetchWindData();

const createChart = () => {
    // Initialize an empty array to hold the speed ranges with frequency data
    const speedRanges = [];

    // Find the minimum and maximum wind speeds in the data
    const minSpeed = Math.min(...WIND_SPEED.map((item) => item.speed));
    const maxSpeed = Math.max(...WIND_SPEED.map((item) => item.speed));

    // Define the number of ranges you want
    const numRanges = 8;

    // Calculate the range size
    const rangeSize = (maxSpeed - minSpeed) / numRanges;

    // Generate the speed ranges
    for (let i = 0; i < numRanges; i++) {
        const rangeMin = minSpeed + i * rangeSize;
        const rangeMax = minSpeed + (i + 1) * rangeSize;

        speedRanges.push({
            name: `${rangeMin.toFixed(1)}-${rangeMax.toFixed(1)} m/s`,
            min: rangeMin,
            max: rangeMax,
            values: Array(8).fill(0), // Initialize with 8 zeros for the 8 directions
        });
    }

    // Populate the frequency arrays based on the data
    WIND_SPEED.forEach((entry) => {
        const speed = entry.speed;
        const dirEntry = WIND_DIRECTION.find((d) => d.date === entry.date);
        if (dirEntry) {
            const dir = dirEntry.direction;
            const rangeIndex = speedRanges.findIndex(
                (range) => speed >= range.min && speed < range.max
            );
            if (rangeIndex !== -1) {
                speedRanges[rangeIndex].values[dir - 1] += 1;
            }
        }
    });

    // Remove the min and max properties from the final output
    speedRanges.forEach((range) => {
        delete range.min;
        delete range.max;
    });

    chartData = speedRanges;

    myChart.setOption(getOption(chartData, "hours"));
};

function calculatePercentage(data) {
    return data.map((item) => {
        const total = item.values.reduce((sum, val) => sum + val, 0);
        console.log("total", total);
        const percentageValues = item.values.map((val) =>
            val === 0 ? 0 : ((val / total) * 100).toFixed(2)
        );
        return {
            ...item,
            values: percentageValues,
        };
    });
}

function getOption(data, unit) {
    return {
        tooltip: {
            trigger: "item",
            formatter: function (params) {
                return (
                    params.seriesName +
                    "<br/>" +
                    "Direction: " +
                    params.name +
                    "<br/>" +
                    "Frequency: " +
                    params.value +
                    (unit === "hours" ? " hours" : " %")
                );
            },
            textStyle: {
                color: "#000",
            },
        },
        color: [
            "#39B185", // Mid Blue
            "#9CCB86", // Mid Cyan-Blue
            "#E9E29C", // Mid Cyan
            "#EEB479", // Mid Teal
            "#E88471", // Mid Olive
        ],
        angleAxis: {
            type: "category",
            data: directions,
            axisTick: {
                show: false,
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: "#ccc",
                },
            },
            axisLabel: {
                show: true,
                interval: 0,
                color: "#333",
            },
        },
        radiusAxis: {
            min: 0,
            max: unit === "hours" ? "20" : "30",
            z: 10,
            axisLabel: {
                backgroundColor: '#fff',
                show: true,
                formatter: function (value) {
                    return value + (unit === "hours" ? " h" : " %");
                },
            },
            axisTick: {
                show: true,
            },
            axisLine: {
                show: true,
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: "#ccc",
                },
            },
        },
        polar: {},
        series: chartData.map((item) => ({
            type: "bar",
            data: item.values,
            coordinateSystem: "polar",
            name: item.name,
            stack: "a",
            emphasis: {
                focus: "series",
            },
        })),
        legend: {
            show: true,
            data: chartData.map((item) => item.name),
            textStyle: {
                color: "#333",
            },
            bottom: -5,
            left: "center",
            right: "center",
        },
    };
}

document
    .getElementById("frequencySelect")
    .addEventListener("change", function (e) {
        const unit = e.target.value;
        const updatedData =
            unit === "percentage" ? calculatePercentage(chartData) : chartData;
        myChart.setOption(getOption(updatedData, unit));
    });