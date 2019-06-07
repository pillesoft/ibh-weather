function Measure(humidity, temparature, pressure, altitude, epochTime) {
    var m = {};
    
    m.humidity = humidity;
    m.temparature = temparature;
    m.pressure = pressure;
    m.altitude = altitude;
    m.epochTime = epochTime;

    return m;
}

module.exports = Measure;
