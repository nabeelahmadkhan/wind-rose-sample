const chart = echarts.init(document.getElementById("myChart"));

const SYMBOL_SIZE = 20;

fetch('data/sample_data.json')
    .then(response => response.json())
    .then(data => {
        jsonData = data;
        createChart(jsonData);
    })
    .catch(error => console.error(error));


function aggregateDailyMaxValues(seriesData) {
    const dailyMaxValues = {};

    // Group data by date and find maximum non-null value for each date
    seriesData.forEach(item => {
        const dateKey = item.date.toISOString().split('T')[0];
        if (item.value !== null && !isNaN(item.value)) { // Check if value is not null and is a valid number
            dailyMaxValues[dateKey] = Math.max(dailyMaxValues[dateKey] || -Infinity, item.value);
        }
    });

    // Convert daily max values to array of objects
    const interpolatedValues = Object.keys(dailyMaxValues).map(dateKey => ({
        date: new Date(dateKey),
        value: Math.floor(dailyMaxValues[dateKey])
    }));

    // Sort the array by date
    interpolatedValues.sort((a, b) => a.date - b.date);

    return interpolatedValues;
}

function addRandomPoints(data, minValue) {
    const newData = [];
    const timestampMap = new Map();
    // Group data by timestamp
    data.forEach(([timestamp, value]) => {
        const timestampKey = timestamp.toString(); // Convert timestamp to string for comparison
        if (!timestampMap.has(timestampKey)) {
            timestampMap.set(timestampKey, []);
        }
        timestampMap.get(timestampKey).push(value);
    });

    // Add random points to only one value in groups with more than one value
    timestampMap.forEach((values, timestampKey) => {
        if (values.length > 1) {
            // Get a random index within the range of the values array
            const randomIndex = Math.floor(Math.random() * values.length);
            // Iterate over the values array, adding random points only to the selected index
            values.forEach((value, index) => {
                const randomPoints = Math.random() + (minValue / 3);
                if (index === randomIndex) {
                    newData.push([parseInt(timestampKey), value]); // Convert timestamp back to integer
                } else {
                    newData.push([parseInt(timestampKey), value + randomPoints]); // Convert timestamp back to integer
                }
            });
        } else {
            // If there's only one value, add it to the new data array without modification
            values.forEach((value) => {
                newData.push([parseInt(timestampKey), value]); // Convert timestamp back to integer
            });
        }
    });

    return newData;
}


function isJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

const createChart = (sampleData) => {
    // Arrays to store data for young leaf, old leaf, and activities
    const young_leaf_data = [], old_leaf_data = [], activityData = [];
    const filteredData = sampleData

    // Extract minimum optimal minimum value from sampleData
    const opt_min = Math.min(...filteredData.filter(res => res.c_crop_id != null).map(item => item.c_opt_min));

    // Iterate through each item in sampleData
    filteredData.map(item => {
        // Push data for young leaf
        young_leaf_data.push({
            value: item.c_young, // Value of young leaf
            date: new Date(item.event_date), // Date of event
            min: item.c_opt_min || opt_min, // Minimum optimal temperature
            max: item.c_opt_max, // Maximum optimal temperature
            type: "young_leaf", // Type of data (young leaf)
        })

        // Push data for old leaf
        old_leaf_data.push({
            value: item.c_old, // Value of old leaf
            date: new Date(item.event_date), // Date of event
            min: item.c_opt_min || opt_min, // Minimum optimal temperature
            max: item.c_opt_max, // Maximum optimal temperature
            type: "old_leaf", // Type of data (old leaf)
        })

        // If calendar_data exists, push it to activityData
        if (item.calendar_data && item.calendar_data.length > 0) {
            if (isJSON(item.calendar_data))
                item.calendar_data = JSON.parse(item.calendar_data)
            item.calendar_data.map(activity => {
                activityData.push(activity);
            })
        }
    });

    // console.log('activity daata', addDateFlag(activityData))

    const actualData = [...young_leaf_data, ...old_leaf_data];
    const dailyData = aggregateDailyMaxValues(actualData);
    const _maxValue = Math.max(...dailyData.map(item => item.value));
    const _minValue = Math.min(...dailyData.map(item => item.value));
    const increment = _maxValue * 0.18;

    const adjustedData = dailyData.map(item => [
        item.date.getTime(),
        item.value + increment
    ]);

    let closestData = []
    activityData.map(activity => {
        const activityDate = new Date(activity.event_end_date).getTime();

        // Find the closest data point
        closestData.push(adjustedData.reduce((prev, curr) => {
            const prevDiff = Math.abs(curr[0] - activityDate);
            const currDiff = Math.abs(prev[0] - activityDate);
            return prevDiff < currDiff ? (curr) : prev;
        }));
    })

    closestData = addRandomPoints(closestData, _minValue);

    const activityPoints = activityData.map((activity, idx) => {

        const activityDate = new Date(activity.event_end_date).getTime();
        const iconFileName = activity.ui_props && activity.ui_props.icon ? activity.ui_props.icon : 'agro_planting.svg';
        const iconPath = `image://assets/icons/${iconFileName}`;
        return {
            name: activity.event_name,
            value: [activityDate, closestData[idx][1] + Math.random()], // Use the jittered y-axis value
            symbolSize: SYMBOL_SIZE,
            symbol: iconPath,
            description: activity.event_description || 'No description available',
        };
    });


    // Option configuration
    const option = {
        grid: {
            top: 35,
            bottom: 75,
            left: 50,
            right: 50
        },
        tooltip: {
            trigger: 'axis',
            formatter: function (params) {
                let tooltipHTML = params[0].axisValueLabel;

                // Iterate through each parameter
                params.forEach(param => {
                    // If the series name is "Young" or "Old", append series name and value to tooltipHTML
                    if (param.seriesName === "Young" || param.seriesName === "Old") {
                        if (param.value[1])
                            tooltipHTML += `<br/>${param.seriesName} : ${param.value[1]}`;
                        else tooltipHTML = null
                    }
                    // If the component type is 'series' and series name is 'Activity', set tooltipHTML to marker and name
                    else if (param.componentType === 'series' && param.seriesName === 'Activity') {
                        tooltipHTML = `${param.marker}${param.name} <br/> ${moment(param.data.value[0]).format('YYYY/DD/MM HH:mm')}`;
                    }
                });

                return tooltipHTML;
            }
        },
        xAxis: {
            type: 'time',
            min: new Date(Math.min(...actualData.map(item => item.date.getTime()))),
            max: new Date(Math.max(...actualData.map(item => item.date.getTime()))),
            splitLine: {
                show: false
            },
            axisLine: {
                show: true
            },
            axisLabel: {
                rotate: 90,
                formatter: function (value) {
                    const date = new Date(value);
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    return `${monthNames[date.getMonth()]} ${date.getDate()}`;
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                fontSize: 12,
            },
            splitLine: {
                show: true,
                lineStyle: {
                    type: 'dashed'
                }
            },
        },
        legend: {
            data: ['Young', 'Old', 'Optimum Range', 'Activity'],
            bottom: 0,
            left: 50,
            orient: 'horizontal'
        },
        dataZoom: [{
            type: 'inside',
            xAxisIndex: [0],
            start: 0,
            end: 100,
            filterMode: 'none'
        }],
        series: [
            {
                name: 'Young',
                data: actualData.filter(item => item.type === 'young_leaf').map(item => [item.date.getTime(), item.value]),
                type: "line",
                symbol: "circle",

                connectNulls: true,
                lineStyle: { color: 'rgb(20, 200, 20)' },
                itemStyle: {
                    color: 'rgb(20, 200, 20)',
                    borderWidth: 2
                },
                symbolSize: 6,
                smooth: true
            },
            {
                name: 'Old',
                data: actualData.filter(item => item.type === 'old_leaf').map(item => [item.date.getTime(), item.value]),

                connectNulls: true,
                type: "line",
                symbol: "circle",
                lineStyle: { color: 'rgb(20, 140, 20)' },
                itemStyle: {
                    color: 'rgb(20, 140, 20)',
                    borderWidth: 2
                },
                symbolSize: 6,
                smooth: true
            },
            {
                name: 'Optimum Range',
                type: 'line',
                showSymbol: false,
                symbol: 'regtangle',
                data: actualData.map(item => [item.date.getTime(), item.max]),
                lineStyle: { color: 'rgb(35, 235, 50, 0)' },
                itemStyle: {
                    color: 'rgb(35, 235, 50, 0.2)',
                    borderWidth: 0
                },
                markArea: {
                    silent: true,
                    itemStyle: {
                        color: 'rgb(35, 235, 50)',
                        opacity: 0.1
                    },
                    data: [[{
                        xAxis: 'max',
                        yAxis: Math.max(...actualData.map(item => item.max))
                    }, {
                        xAxis: 'min',
                        yAxis: Math.min(...actualData.map(item => item.min))
                    }]]
                }
            },
            {
                data: activityPoints,
                symbolSize: 20,
                name: 'Activity',
                type: 'scatter',
                symbol: 'circle',
                emphasis: {
                    label: {
                        lineHeight: 12,
                        padding: 5,
                        opacity: 1
                    }
                },
                labelLayout: { hideOverlap: true, dy: 10 },
                events: {
                    onClick: function (params) {
                        alert('s')
                        // console.log('Clicked on scatter point:', params.data);
                        // Handle click event for scatter points here
                        // You can access params.data to get information about the clicked point
                        // For example, params.data.name, params.data.value, etc.
                    }
                }
            },
        ],
    };

    // Set option and render chart
    chart.setOption(option);

}