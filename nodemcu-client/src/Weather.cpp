#include "Weather.h"

char days[7][13] = {"Vasárnap", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat"};
char months[12][5] = {"Jan", "Feb", "Már", "Ápr", "Máj", "Jún", "Júl", "Aug", "Szep", "Okt", "Nov", "Dec"};

Weather::Weather(float hum, float temp, float press, float alt, unsigned long epoch): 
    humidity(hum), temperature(temp), pressure(press), altitude(alt), epochTime(epoch) {}

float Weather::getHumidity() {
    return humidity;
}
float Weather::getTemperature() {
    return temperature;
}
float Weather::getPressure() {
    return pressure;
}
float Weather::getAltitude() {
    return altitude;
}
unsigned long Weather::getEpochTime() {
    return epochTime;
}

String Weather::toJson() {
    char json[150];
    sprintf(json, "{\"humidity\":%f,\"temparature\":%.2f,\"pressure\":%f,\"altitude\":%f,\"epochTime\":%lu}", humidity, temperature, pressure, altitude, epochTime);
    return json;

    //return sprintf_P(PSTR("{\"humidity\":%f,\"temparature\":%s,\"pressure\":%s,\"altitude\":%s,\"epochTime\":%s}"), humidity, temperature, pressure, altitude, epochTime);
    /*
    char temp[9];
    char str_temp[3];
    dtostrf(temperature, 5, 2, str_temp);
    sprintf(temp, "%s C", str_temp);
    return temp;
    */
}

String Weather::getMeasureTime() {
    time_t epoch = epochTime;
    struct tm *timeinfo;
    char buf[80];
    timeinfo = localtime(&epoch);
    sprintf(buf, "%i-%s-%02i., %s %02i:%02i:%02i", 1900+timeinfo->tm_year, months[timeinfo->tm_mon], timeinfo->tm_mday, days[timeinfo->tm_wday], timeinfo->tm_hour, timeinfo->tm_min, timeinfo->tm_sec);
    //strftime(buf, sizeof(buf), "%a %Y-%m-%d %H:%M:%S %Z", timeinfo);
//    return asctime(timeinfo);
    return buf;

}
