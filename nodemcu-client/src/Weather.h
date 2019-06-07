#include <Arduino.h>


class Weather {
    private:
        float humidity;
        float temperature;
        float pressure;
        float altitude;
        unsigned long epochTime;
    public:
        Weather(float hum, float temp, float press, float alt, unsigned long epoch);
        float getHumidity();
        float getTemperature();
        float getPressure();
        float getAltitude();
        unsigned long getEpochTime();

        String toJson();
        String getMeasureTime();


};
