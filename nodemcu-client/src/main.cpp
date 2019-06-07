#include <Arduino.h>
#include <vector>
#include <Wire.h>
#include "SparkFunBME280.h"
#include "ESP8266WiFi.h"
//#include <WiFiClient.h>
#include "ESP8266WebServer.h"
#include <WiFiUdp.h>
#include <NTPClient.h>

#include "authenticate.h"
#include "Weather.h"

// to get coordinate of an address
//https://nominatim.openstreetmap.org/search.php?q=varpalota%2C+szabolcska+mihaly+103&polygon_geojson=1&viewbox=
//https://developer.mapquest.com/documentation/open/nominatim-search/

// to get elevation of a coordinate
//https://github.com/Jorl17/open-elevation/blob/master/docs/api.md
//https://developer.mapquest.com/documentation/open/elevation-api/

using std::vector;

#define Common_SDA    0  // D3 láb - adatszál
#define Common_SCL    2  // D4 láb - órajel
#define SLEEP_TIME 2*60*1000000   // sleep intervalls in us

BME280 bmp280Sensor;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "europe.pool.ntp.org", 7200);

int BMP280_Address = 0x76;
bool sensorBME280 = false;
vector<Weather> data;
int elevation = 0;

ESP8266WebServer webserver(80);

const char HTML_header[] = R"=====(
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>IBH Weather</title>
</head>
<body>
)=====";
const char HTML_footer[] = R"=====(
</body>
</html>
)=====";

const char ELEVATIONFORM_page[] = R"=====(
<h3>Tengerszint Feletti Magasság</h3>
 
<form action="/elevation" method="post">
  Tengerszint feletti magasság (méter):<br>
  <input type="text" name="elevation">
  <br><br>
  <input type="submit" value="Mentés">
</form> 
)=====";

const char MAIN_page[] = R"=====(
<h3>Fő oldal</h3>
<a href="/elevation">Add meg a tengerszint feletti magasságot</>
)=====";

void initBME280()
{
  bmp280Sensor.setI2CAddress(BMP280_Address); //I2C cím
  bmp280Sensor.setMode(MODE_NORMAL); //érzékelő mód
  
  if (bmp280Sensor.beginI2C() == false) //kommunikáció kezdete I2C protokollon a BME280-al
  {
    Serial.println("A BME280 nem talalhato, ellenorizd a vezetekezest.");
  }
  else {
    bmp280Sensor.setReferencePressure(101325); //Adjust the sea level pressure used for altitude calculations

    Serial.println("BME280 inicializáció kész!");
    sensorBME280 = true;
  }
}

//HTTP kérések alapértelmezett feldolgozása
void handleGetRoot() {
  char html[500];
  sprintf(html, "%s%s%s", HTML_header, MAIN_page, HTML_footer);
  webserver.send(200, "text/html", html);
}

void handleGetElevation() {
  char html[500];
  sprintf(html, "%s%s%s", HTML_header, ELEVATIONFORM_page, HTML_footer);
  webserver.send(200, "text/html", html);
}

void handleGetCurrentMeasures() { 
  Weather currentdata = data.back();

  String content =  "<!DOCTYPE html>";
  content += "<html dir=\"ltr\" lang=\"en-gb\">";
  content += "<head>";
  content += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
  content += "<meta charset=\"utf-8\" />";
  content += "</head>";
  content += "<body style=\"background: #1f1f1f;color: whitesmoke;font-size: large;font-family:\"Arial\";\">";
  content += "<h3 style='border: 1px solid black;padding: 12px;background:#183693;position: relative;left: -10px;width: 100%;'>";
  content += "<b><strong>BME280 adatok</strong></b></h3><br>";
  content += "Hőmérséklet: "+String(currentdata.getTemperature())+" C<br/>";
  content += "Páratartalom: "+String(currentdata.getHumidity())+" %<br/>";
  content += "Légnyomás: "+String(currentdata.getPressure())+" Pa<br/>";
  content += "Magasság: "+String(currentdata.getAltitude())+" m<br/>";
  content += "Mérés ideje: "+String(currentdata.getMeasureTime())+"<br/>";
  content += "<br>";
  content += "<h3 style='border: 1px solid black;padding: 12px;background:#183693;position: relative;left: -10px;width: 100%;'>";
  content += "<b><strong>Rendszerinformációk</strong></b></h3><br>";
  content += "CPU órajel: " + String(ESP.getCpuFreqMHz()) + "MHz<br>";
  content += "Programkód: " + String(ESP.getSketchSize()) + "<br>";
  content += "Flash chip mérete: " + String( ESP.getFlashChipSize()) + "byte<br>";
  content += "Szabad memória: " + String( ESP.getFreeHeap()) + "byte<br>";
  content += "<h3 style='border: 1px solid black;padding: 12px;background:#183693;position: relative;left: -10px;width: 100%;'>";
  content += "<p style=\"color:#fefefe;\">Developed by Nokia GarageLab</p>";
  content += "</h3>";
  content += "</body>"; 
  content += "</html>"; 
  
  webserver.send(200, "text/html", content);
}

//ismeretlen URL-re mutató HTTP kérések alapértelmezett oldala
void handleNotFound(){
  String message = "File Not Found\n\n";
  message += "URI: ";
  message += webserver.uri();
  message += "\nMethod: ";
  message += (webserver.method() == HTTP_GET)?"GET":"POST";
  message += "\nArguments: ";
  message += webserver.args();
  message += "\n";
  for (uint8_t i=0; i<webserver.args(); i++){
    message += " " + webserver.argName(i) + ": " + webserver.arg(i) + "\n";
  }
  webserver.send(404, "text/plain", message);

}

void handlePostElevation() {
  String frmelev = webserver.arg("elevation");
  elevation = frmelev.toInt();
  Serial.print("Received elevation: ");
  Serial.println(elevation);
}

void setup() {
  Serial.begin(9600);
  Serial.println();

  Wire.begin(Common_SDA,Common_SCL);
  //Wire.setClock(400000); //Increase to fast I2C speed!

  initBME280();

  WiFi.begin(wifi_ssid, wifi_password);

  while ( WiFi.status() != WL_CONNECTED ) {
    delay(500);
    Serial.print(".");
  }
  Serial.print("Connected to Wifi - IP: ");
  Serial.println(WiFi.localIP());

  timeClient.begin();
 
  // Alapértelmezett oldal
  webserver.on("/", handleGetRoot);
  webserver.on("/measure", handleGetCurrentMeasures);
  webserver.on("/elevation", HTTP_GET, handleGetElevation);
  webserver.on("/elevation", HTTP_POST, handlePostElevation);

  // Nem található oldalak
  webserver.onNotFound(handleNotFound);

  //HTTP server inditása
  webserver.begin();
  Serial.println("HTTP server started");

}

void loop() {
  webserver.handleClient();
  
  delay(1000);

  if (!sensorBME280) {
    return;
  }

  if(elevation == 0) {
    Serial.println("Please specify elevation");
    return;
  }

  timeClient.update();

  Weather record(
    bmp280Sensor.readFloatHumidity(), 
    bmp280Sensor.readTempC(),
    bmp280Sensor.readFloatPressure(),
    bmp280Sensor.readFloatAltitudeMeters(),
    timeClient.getEpochTime());

  Serial.print("Humidity: ");
  Serial.print(record.getHumidity(), 0);

  Serial.print(" Pressure: ");
  Serial.print(record.getPressure(), 0);

  Serial.print(" Locally Adjusted Altitude: ");
  Serial.print(record.getAltitude(), 1);

  Serial.print(" Temp: ");
  Serial.print(record.getTemperature(), 2);

  Serial.print(" Time: ");
  Serial.println(timeClient.getFormattedTime());

  Serial.println();

  // maximum it can store 1024 item
  data.push_back(record);

  Serial.print(" Size of data: ");
  Serial.println(static_cast<int>(data.size()));

  Serial.print(" Free heap space: ");
  Serial.println(static_cast<int>(ESP.getFreeHeap()));

  Serial.println(record.toJson());

  //Serial.print(" going to sleep. good night ... ");
  //ESP.deepSleep(SLEEP_TIME, WAKE_RF_DISABLED);
  //yield();
  
}