/*
SQLyog Community v13.2.1 (64 bit)
MySQL - 10.6.2-MariaDB-1:10.6.2+maria~focal : Database - base_tmu_company_table_v2
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`base_tmu_company_table_v2` /*!40100 DEFAULT CHARACTER SET utf8mb4 */;

USE `base_tmu_company_table_v2`;

/*Table structure for table `constanta_value` */

DROP TABLE IF EXISTS `constanta_value`;

CREATE TABLE `constanta_value` (
  `type` varchar(15) NOT NULL,
  `windingExponent` float DEFAULT NULL,
  `K21` float DEFAULT NULL,
  `K22` float DEFAULT NULL,
  `T0` float DEFAULT NULL,
  `Tw` float DEFAULT NULL,
  PRIMARY KEY (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `constanta_value` */

insert  into `constanta_value`(`type`,`windingExponent`,`K21`,`K22`,`T0`,`Tw`) values 
('OD',2,1,1,90,7),
('OF',1.3,1.3,1,90,7),
('OFrestricted',1.3,1.45,1,90,7),
('ONAF',1.3,2,2,150,7),
('ONAFrestricted',1.3,3,2,150,7),
('ONAN',1.3,2,2,210,10),
('ONANrestricted',1.3,3,2,210,10),
('ONANsmall',1.6,1,2,180,4);

/*Table structure for table `failure_log` */

DROP TABLE IF EXISTS `failure_log`;

CREATE TABLE `failure_log` (
  `rowId` int(11) NOT NULL AUTO_INCREMENT,
  `trafoId` int(1) DEFAULT NULL,
  `failure_id` int(11) DEFAULT NULL,
  `time_start` datetime DEFAULT NULL,
  `duration` bigint(20) DEFAULT NULL,
  `failure_type` text DEFAULT NULL,
  `parameter` text DEFAULT NULL,
  `parameterValue` text DEFAULT NULL,
  PRIMARY KEY (`rowId`),
  KEY `failure_id` (`rowId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `failure_log` */

/*Table structure for table `parameter_failure_recommendation` */

DROP TABLE IF EXISTS `parameter_failure_recommendation`;

CREATE TABLE `parameter_failure_recommendation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `parameter` varchar(15) DEFAULT NULL,
  `recommendation` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=92 DEFAULT CHARSET=latin1;

/*Data for the table `parameter_failure_recommendation` */

insert  into `parameter_failure_recommendation`(`id`,`parameter`,`recommendation`) values 
(1,'Van','Check input voltage Tx from PLN or source power meter, if input low/high contact PLN/power source PIC'),
(2,'Van','If PLN/Power source normal, check load balance R-S-T if unbalance'),
(3,'Van','Shutdown Tx and check Neutral connection'),
(4,'Van','Release all cable/wire from transformer and check the transformer megger HV-LV(1 Gohm), HL-LG(1 Gohm), LV-G(500 Mohm)'),
(5,'Van','Check transformer turn ratio or contact PT. B&D (Telp: )'),
(6,'Vbn','Check input voltage Tx from PLN or source power meter, if input low/high contact PLN/power source PIC'),
(7,'Vbn','If PLN/Power source normal, check load balance R-S-T if unbalance'),
(8,'Vbn','Shutdown Tx and check Neutral connection'),
(9,'Vbn','Release all cable/wire from transformer and check the transformer megger HV-LV(1 Gohm), HL-LG(1 Gohm), LV-G(500 Mohm)'),
(10,'Vbn','Check transformer turn ratio or contact PT. B&D (Telp: )'),
(11,'Vcn','Check input voltage Tx from PLN or source power meter, if input low/high contact PLN/power source PIC'),
(12,'Vcn','If PLN/Power source normal, check load balance R-S-T if unbalance'),
(13,'Vcn','Shutdown Tx and check Neutral connection'),
(14,'Vcn','Release all cable/wire from transformer and check the transformer megger HV-LV(1 Gohm), HL-LG(1 Gohm), LV-G(500 Mohm)'),
(15,'Vcn','Check transformer turn ratio or contact PT. B&D (Telp: )'),
(16,'Vab','Check input voltage Tx from PLN or source power meter, if input low/high contact PLN/power source PIC'),
(17,'Vab','If PLN/Power source normal, check load balance R-S-T if unbalance'),
(18,'Vab','Shutdown Tx and check Neutral connection'),
(19,'Vab','Release all cable/wire from transformer and check the transformer megger HV-LV(1 Gohm), HL-LG(1 Gohm), LV-G(500 Mohm)'),
(20,'Vab','Check transformer turn ratio or contact PT. B&D (Telp: )'),
(21,'Vbc','Check input voltage Tx from PLN or source power meter, if input low/high contact PLN/power source PIC'),
(22,'Vbc','If PLN/Power source normal, check load balance R-S-T if unbalance'),
(23,'Vbc','Shutdown Tx and check Neutral connection'),
(24,'Vbc','Release all cable/wire from transformer and check the transformer megger HV-LV(1 Gohm), HL-LG(1 Gohm), LV-G(500 Mohm)'),
(25,'Vbc','Check transformer turn ratio or contact PT. B&D (Telp: )'),
(26,'Vca','Check input voltage Tx from PLN or source power meter, if input low/high contact PLN/power source PIC'),
(27,'Vca','If PLN/Power source normal, check load balance R-S-T if unbalance'),
(28,'Vca','Shutdown Tx and check Neutral connection'),
(29,'Vca','Release all cable/wire from transformer and check the transformer megger HV-LV(1 Gohm), HL-LG(1 Gohm), LV-G(500 Mohm)'),
(30,'Vca','Check transformer turn ratio or contact PT. B&D (Telp: )'),
(31,'Uab','Check input voltage Tx from PLN or source power meter, if input low/high contact PLN/power source PIC'),
(32,'Uab','If PLN/Power source normal, check load balance R-S-T if unbalance'),
(33,'Uab','Shutdown Tx and check Neutral connection'),
(34,'Uab','Release all cable/wire from transformer and check the transformer megger HV-LV(1 Gohm), HL-LG(1 Gohm), LV-G(500 Mohm)'),
(35,'Uab','Check transformer turn ratio or contact PT. B&D (Telp: )'),
(36,'Ubc','Check input voltage Tx from PLN or source power meter, if input low/high contact PLN/power source PIC'),
(37,'Ubc','If PLN/Power source normal, check load balance R-S-T if unbalance'),
(38,'Ubc','Shutdown Tx and check Neutral connection'),
(39,'Ubc','Release all cable/wire from transformer and check the transformer megger HV-LV(1 Gohm), HL-LG(1 Gohm), LV-G(500 Mohm)'),
(40,'Ubc','Check transformer turn ratio or contact PT. B&D (Telp: )'),
(41,'Uca','Check input voltage Tx from PLN or source power meter, if input low/high contact PLN/power source PIC'),
(42,'Uca','If PLN/Power source normal, check load balance R-S-T if unbalance'),
(43,'Uca','Shutdown Tx and check Neutral connection'),
(44,'Uca','Release all cable/wire from transformer and check the transformer megger HV-LV(1 Gohm), HL-LG(1 Gohm), LV-G(500 Mohm)'),
(45,'Uca','Check transformer turn ratio or contact PT. B&D (Telp: )'),
(46,'Freq','Check Input voltage Tx from PLN or Source Power Meter, If Input Low/High contact PLN/power source PIC'),
(47,'Freq','Shut down Tx, Release all cable/wire from transformer and Check the transformer Megger HV-LV (1 Gohm ), HL-G (1 Gohm), LV - G( 500 Mohm)'),
(48,'Freq','Check Tranformer turn ratio or contact PT. B&D (tlp……)'),
(49,'OilTemp','Check Load R-S-T, if overload reduece the load'),
(50,'OilTemp','Check Winding Temp R-S-T, if overtemp see Winding temperature Failure recommendation'),
(51,'OilTemp','Check K-rated R-S-T, if High shutdown non linear load'),
(52,'OilTemp','Check using thermo gun area oil temp or top tank, if high Chec radiator temp'),
(53,'OilTemp','Check Radiator (if Panel Radiator w/ valve, make sure it\'s open)'),
(54,'OilTemp','If all is normal contact B&D (tlp….), possible failure at Oil Thermo sensor'),
(55,'OilLevel','Check Oil level sightglass, if lower, wait for a while maybe gas Fault, if Gas Fault, oil level should be normal again'),
(56,'OilLevel','If lower a long time, check leakage at tank, radiator , cover and bushing if  leakage call B&D (tlp…)'),
(57,'OilLevel','If all normal, contact B&D (tlp……..) maybe Sensor failure'),
(58,'GasFault','Wait each day if any gas again and level back to normal after alarm/trip call B&D (tlp…) to check gas fault'),
(59,'GasFault','If all normal, contact B&D (tlp……..) maybe Sensor failure'),
(60,'Pressure','Check load R-S-T, if overload reduce load'),
(61,'Pressure','Check  Oil Temperature, if high follow Oil Temperature Failure recommendation, if normal'),
(62,'Pressure','Check Radiator and see phisically become bloated or normal'),
(63,'Pressure','If all normal, contact B&D (tlp……..) maybe sensor failure'),
(64,'PF','Check Load R-S-T, low load or normal load, if low need to adjust capacitor bank minumum operation'),
(65,'PF','Check Capacitor bank normal or not'),
(66,'PF','Check source PLN/power source normal or not, if not call PLN or power source PIC'),
(67,'PF','If all normal, contact B&D (tlp……..) maybe power meter and sensor failure'),
(68,'WTITemp','Check Load R-S-T, if overload reduece the load'),
(69,'WTITemp','Check Top Oil Temp, if overtemp see Top Oil temperature Failure recommendation'),
(70,'WTITemp','Check K-rated R-S-T, if High shutdown non linear load'),
(71,'WTITemp','Check using thermo gun area oil temp or top tank, if high Chec radiator temp'),
(72,'WTITemp','Check Radiator (if Panel Radiator w/ valve, make sure it\'s open)'),
(73,'WTITemp','Check using thermo gun area Bushing and busbar, if high, shut down Tx and Check cable/busbar Connection'),
(74,'WTITemp','If all is normal contact B&D (tlp….), possible failure at Winding Thermo sensor or problem inside winding Tx'),
(75,'BusTemp','Check Load R-S-T, if overload reduece the load'),
(76,'BusTemp','Check Top Oil Temp, if overtemp see Top Oil temperature Failure recommendation'),
(77,'BusTemp','Check Winding Temp R-S-T, if overtemp see Winding temperature Failure recommendation'),
(78,'BusTemp','Check K-rated R-S-T, if High shutdown non linear load'),
(79,'BusTemp','Check using thermo gun area oil temp or top tank, if high Chec radiator temp'),
(80,'BusTemp','Check Radiator (if Panel Radiator w/ valve, make sure it\'s open)'),
(81,'BusTemp','Check using thermo gun area Bushing and busbar, if high, shut down Tx and Check cable/busbar Connection'),
(82,'BusTemp','If all is normal contact B&D (tlp….), possible failure at Busbar Thermo sensor'),
(83,'THDCurrent','Check Load, if small load maybe it\'s normal and see again at normal load'),
(84,'THDCurrent','If normal load, using portable online power quality /power meter compare the THD'),
(85,'THDCurrent','If high check or shut down non linear/static load that using rectifier, diode, SCR/IGBT'),
(86,'THDCurrent','If all normal, contact B&D (tlp……..) maybe power meter and sensor failure'),
(87,'THDVoltage','Check using portable online power quality /power meter compare the THD'),
(88,'THDVoltage','If high check or shut down non linear/static load that using rectifier, diode, SCR/IGBT'),
(89,'THDVoltage','If all normal, contact B&D (tlp……..) maybe power meter and sensor failure'),
(90,'Current','Using Ammeter check load R-S-T normal or not if to high reduce load'),
(91,'Current','If all normal, contact B&D (tlp……..) maybe CT or power meter and sensor failure');

/*Table structure for table `reading_data` */

DROP TABLE IF EXISTS `reading_data`;

CREATE TABLE `reading_data` (
  `data_id` int(11) NOT NULL AUTO_INCREMENT,
  `trafoId` int(11) DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `Van` double DEFAULT NULL,
  `Vbn` double DEFAULT NULL,
  `Vcn` double DEFAULT NULL,
  `Vab` double DEFAULT NULL,
  `Vbc` double DEFAULT NULL,
  `Vca` double DEFAULT NULL,
  `Ia` double DEFAULT NULL,
  `Ib` double DEFAULT NULL,
  `Ic` double DEFAULT NULL,
  `Iavg` double DEFAULT NULL,
  `Ineutral` double DEFAULT 0,
  `THDV1` double DEFAULT 0,
  `THDV2` double DEFAULT 0,
  `THDV3` double DEFAULT 0,
  `THDI1` double DEFAULT 0,
  `THDI2` double DEFAULT 0,
  `THDI3` double DEFAULT 0,
  `Pa` double DEFAULT NULL,
  `Pb` double DEFAULT NULL,
  `Pc` double DEFAULT NULL,
  `Psig` double DEFAULT NULL,
  `Qa` double DEFAULT NULL,
  `Qb` double DEFAULT NULL,
  `Qc` double DEFAULT NULL,
  `Qsig` double DEFAULT NULL,
  `Sa` double DEFAULT NULL,
  `Sb` double DEFAULT NULL,
  `Sc` double DEFAULT NULL,
  `Ssig` double DEFAULT NULL,
  `PFa` double DEFAULT NULL,
  `PFb` double DEFAULT NULL,
  `PFc` double DEFAULT NULL,
  `PFsig` double DEFAULT NULL,
  `Freq` double DEFAULT NULL,
  `kWh` double DEFAULT NULL,
  `kVARh` double DEFAULT NULL,
  `BusTemp1` double DEFAULT NULL,
  `BusTemp2` double DEFAULT 30,
  `BusTemp3` double DEFAULT 30,
  `OilTemp` double DEFAULT 30,
  `WTITemp1` double DEFAULT 30,
  `WTITemp2` double DEFAULT 30,
  `WTITemp3` double DEFAULT 30,
  `Press` double DEFAULT NULL,
  `Level` smallint(6) DEFAULT NULL,
  `KRateda` smallint(6) DEFAULT 1,
  `deRatinga` double DEFAULT 100,
  `KRatedb` smallint(6) DEFAULT NULL,
  `deRatingb` double DEFAULT NULL,
  `KRatedc` smallint(6) DEFAULT NULL,
  `deRatingc` double DEFAULT NULL,
  `H2ppm` smallint(6) DEFAULT NULL,
  `Moistureppm` smallint(6) DEFAULT NULL,
  `UnbalanceUV` double DEFAULT NULL,
  `UnbalanceVW` double DEFAULT NULL,
  `UnbalanceUW` double DEFAULT NULL,
  PRIMARY KEY (`data_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `reading_data` */

/*Table structure for table `report_data_shrink` */

DROP TABLE IF EXISTS `report_data_shrink`;

CREATE TABLE `report_data_shrink` (
  `data_id` int(11) NOT NULL AUTO_INCREMENT,
  `trafoId` int(11) DEFAULT NULL,
  `timestamp` date DEFAULT NULL,
  `kWhTot` float DEFAULT NULL,
  `kVARhTot` float DEFAULT NULL,
  `maxVan` float DEFAULT NULL,
  `minVan` float DEFAULT NULL,
  `avgVan` float DEFAULT NULL,
  `maxVbn` float DEFAULT NULL,
  `minVbn` float DEFAULT NULL,
  `avgVbn` float DEFAULT NULL,
  `maxVcn` float DEFAULT NULL,
  `minVcn` float DEFAULT NULL,
  `avgVcn` float DEFAULT NULL,
  `maxFrequency` float DEFAULT NULL,
  `minFrequency` float DEFAULT NULL,
  `avgFrequency` float DEFAULT NULL,
  `maxPowerFactor` float DEFAULT NULL,
  `minPowerFactor` float DEFAULT NULL,
  `avgPowerFactor` float DEFAULT NULL,
  `maxActivePower` float DEFAULT NULL,
  `minActivePower` float DEFAULT NULL,
  `avgActivePower` float DEFAULT NULL,
  `maxReactivePower` float DEFAULT NULL,
  `minReactivePower` float DEFAULT NULL,
  `avgReactivePower` float DEFAULT NULL,
  `maxApparentPower` float DEFAULT NULL,
  `minApparentPower` float DEFAULT NULL,
  `avgApparentPower` float DEFAULT NULL,
  `maxTHDI1` float DEFAULT NULL,
  `minTHDI1` float DEFAULT NULL,
  `avgTHDI1` float DEFAULT NULL,
  `maxTHDI2` float DEFAULT NULL,
  `minTHDI2` float DEFAULT NULL,
  `avgTHDI2` float DEFAULT NULL,
  `maxTHDI3` float DEFAULT NULL,
  `minTHDI3` float DEFAULT NULL,
  `avgTHDI3` float DEFAULT NULL,
  `maxIneutral` float DEFAULT NULL,
  `minIneutral` float DEFAULT NULL,
  `avgIneutral` float DEFAULT NULL,
  `maxIa` float DEFAULT NULL,
  `minIa` float DEFAULT NULL,
  `avgIa` float DEFAULT NULL,
  `maxIb` float DEFAULT NULL,
  `minIb` float DEFAULT NULL,
  `avgIb` float DEFAULT NULL,
  `maxIc` float DEFAULT NULL,
  `minIc` float DEFAULT NULL,
  `avgIc` float DEFAULT NULL,
  `maxH2ppm` float DEFAULT NULL,
  `minH2ppm` float DEFAULT NULL,
  `avgH2ppm` float DEFAULT NULL,
  `maxMoistureppm` float DEFAULT NULL,
  `minMoistureppm` float DEFAULT NULL,
  `avgMoistureppm` float DEFAULT NULL,
  PRIMARY KEY (`data_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `report_data_shrink` */

/*Table structure for table `temp_current_harmonic` */

DROP TABLE IF EXISTS `temp_current_harmonic`;

CREATE TABLE `temp_current_harmonic` (
  `Phase` smallint(6) DEFAULT NULL,
  `1st` double DEFAULT NULL,
  `3rd` double DEFAULT NULL,
  `5th` double DEFAULT NULL,
  `7th` double DEFAULT NULL,
  `9th` double DEFAULT NULL,
  `11th` double DEFAULT NULL,
  `13th` double DEFAULT NULL,
  `15th` double DEFAULT NULL,
  `17th` double DEFAULT NULL,
  `19th` double DEFAULT NULL,
  `21th` double DEFAULT NULL,
  `23th` double DEFAULT NULL,
  `25th` double DEFAULT NULL,
  `27th` double DEFAULT NULL,
  `29th` double DEFAULT NULL,
  `31th` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `temp_current_harmonic` */

insert  into `temp_current_harmonic`(`Phase`,`1st`,`3rd`,`5th`,`7th`,`9th`,`11th`,`13th`,`15th`,`17th`,`19th`,`21th`,`23th`,`25th`,`27th`,`29th`,`31th`) values 
(1,100,5.4,4.4,4.1,1.1,3.1,2.8,1.5,3.8,4.4,0,2.2,2.3,0.6,1.1,0.6),
(2,100,3.2,9.7,4.1,1.2,5.4,3.9,1.3,4.7,3.9,1.8,3.9,3.4,0.7,1.1,1.6),
(3,100,8.6,5.8,5.3,2.3,5.4,3.3,2.4,6.2,3.6,1.2,2.6,2.9,1.1,1,0.7);

/*Table structure for table `temp_instantaneous_report_data` */

DROP TABLE IF EXISTS `temp_instantaneous_report_data`;

CREATE TABLE `temp_instantaneous_report_data` (
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `Van` double DEFAULT NULL,
  `Vbn` double DEFAULT NULL,
  `Vcn` double DEFAULT NULL,
  `Vab` double DEFAULT NULL,
  `Vbc` double DEFAULT NULL,
  `Vca` double DEFAULT NULL,
  `Ia` double DEFAULT NULL,
  `Ib` double DEFAULT NULL,
  `Ic` double DEFAULT NULL,
  `Iavg` double DEFAULT NULL,
  `Ineutral` double DEFAULT 0,
  `THDV1` double DEFAULT 0,
  `THDV2` double DEFAULT 0,
  `THDV3` double DEFAULT 0,
  `THDI1` double DEFAULT 0,
  `THDI2` double DEFAULT 0,
  `THDI3` double DEFAULT 0,
  `Pa` double DEFAULT NULL,
  `Pb` double DEFAULT NULL,
  `Pc` double DEFAULT NULL,
  `Psig` double DEFAULT NULL,
  `Qa` double DEFAULT NULL,
  `Qb` double DEFAULT NULL,
  `Qc` double DEFAULT NULL,
  `Qsig` double DEFAULT NULL,
  `Sa` double DEFAULT NULL,
  `Sb` double DEFAULT NULL,
  `Sc` double DEFAULT NULL,
  `Ssig` double DEFAULT NULL,
  `PFa` double DEFAULT NULL,
  `PFb` double DEFAULT NULL,
  `PFc` double DEFAULT NULL,
  `PFsig` double DEFAULT NULL,
  `Freq` double DEFAULT NULL,
  `kWh` double DEFAULT NULL,
  `kVARh` double DEFAULT NULL,
  `BusTemp1` double DEFAULT NULL,
  `BusTemp2` double DEFAULT 30,
  `BusTemp3` double DEFAULT 30,
  `OilTemp` double DEFAULT 30,
  `WTITemp1` double DEFAULT 30,
  `WTITemp2` double DEFAULT 30,
  `WTITemp3` double DEFAULT 30,
  `Press` double DEFAULT NULL,
  `Level` smallint(6) DEFAULT NULL,
  `KRateda` smallint(6) DEFAULT 1,
  `deRatinga` double DEFAULT 100,
  `KRatedb` smallint(6) DEFAULT NULL,
  `deRatingb` double DEFAULT NULL,
  `KRatedc` smallint(6) DEFAULT NULL,
  `deRatingc` double DEFAULT NULL,
  `H2ppm` smallint(6) DEFAULT NULL,
  `Moistureppm` smallint(6) DEFAULT NULL,
  `UnbalanceUV` double DEFAULT NULL,
  `UnbalanceVW` double DEFAULT NULL,
  `UnbalanceUW` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `temp_instantaneous_report_data` */

/*Table structure for table `temp_performance_report_data_daily` */

DROP TABLE IF EXISTS `temp_performance_report_data_daily`;

CREATE TABLE `temp_performance_report_data_daily` (
  `unit_consumption` float DEFAULT NULL,
  `kVARhTot` float DEFAULT NULL,
  `maxVan` float DEFAULT NULL,
  `minVan` float DEFAULT NULL,
  `avgVan` float DEFAULT NULL,
  `maxVbn` float DEFAULT NULL,
  `minVbn` float DEFAULT NULL,
  `avgVbn` float DEFAULT NULL,
  `maxVcn` float DEFAULT NULL,
  `minVcn` float DEFAULT NULL,
  `avgVcn` float DEFAULT NULL,
  `maxFrequency` float DEFAULT NULL,
  `minFrequency` float DEFAULT NULL,
  `avgFrequency` float DEFAULT NULL,
  `maxPowerFactor` float DEFAULT NULL,
  `minPowerFactor` float DEFAULT NULL,
  `avgPowerFactor` float DEFAULT NULL,
  `maxActivePower` float DEFAULT NULL,
  `minActivePower` float DEFAULT NULL,
  `avgActivePower` float DEFAULT NULL,
  `maxReactivePower` float DEFAULT NULL,
  `minReactivePower` float DEFAULT NULL,
  `avgReactivePower` float DEFAULT NULL,
  `maxApparentPower` float DEFAULT NULL,
  `minApparentPower` float DEFAULT NULL,
  `avgApparentPower` float DEFAULT NULL,
  `maxTHDI1` float DEFAULT NULL,
  `minTHDI1` float DEFAULT NULL,
  `avgTHDI1` float DEFAULT NULL,
  `maxTHDI2` float DEFAULT NULL,
  `minTHDI2` float DEFAULT NULL,
  `avgTHDI2` float DEFAULT NULL,
  `maxTHDI3` float DEFAULT NULL,
  `minTHDI3` float DEFAULT NULL,
  `avgTHDI3` float DEFAULT NULL,
  `maxIneutral` float DEFAULT NULL,
  `minIneutral` float DEFAULT NULL,
  `avgIneutral` float DEFAULT NULL,
  `maxIa` float DEFAULT NULL,
  `minIa` float DEFAULT NULL,
  `avgIa` float DEFAULT NULL,
  `maxIb` float DEFAULT NULL,
  `minIb` float DEFAULT NULL,
  `avgIb` float DEFAULT NULL,
  `maxIc` float DEFAULT NULL,
  `minIc` float DEFAULT NULL,
  `avgIc` float DEFAULT NULL,
  `maxH2ppm` float DEFAULT NULL,
  `minH2ppm` float DEFAULT NULL,
  `avgH2ppm` float DEFAULT NULL,
  `maxMoistureppm` float DEFAULT NULL,
  `minMoistureppm` float DEFAULT NULL,
  `avgMoistureppm` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_slovenian_ci;

/*Data for the table `temp_performance_report_data_daily` */

/*Table structure for table `temp_reading_data_realtime` */

DROP TABLE IF EXISTS `temp_reading_data_realtime`;

CREATE TABLE `temp_reading_data_realtime` (
  `data_id` int(11) NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `Van` double DEFAULT NULL,
  `Vbn` double DEFAULT NULL,
  `Vcn` double DEFAULT NULL,
  `Vab` double DEFAULT NULL,
  `Vbc` double DEFAULT NULL,
  `Vca` double DEFAULT NULL,
  `Ia` double DEFAULT NULL,
  `Ib` double DEFAULT NULL,
  `Ic` double DEFAULT NULL,
  `Iavg` double DEFAULT NULL,
  `Ineutral` double DEFAULT 0,
  `THDV1` double DEFAULT 0,
  `THDV2` double DEFAULT 0,
  `THDV3` double DEFAULT 0,
  `THDI1` double DEFAULT 0,
  `THDI2` double DEFAULT 0,
  `THDI3` double DEFAULT 0,
  `Pa` double DEFAULT NULL,
  `Pb` double DEFAULT NULL,
  `Pc` double DEFAULT NULL,
  `Psig` double DEFAULT NULL,
  `Qa` double DEFAULT NULL,
  `Qb` double DEFAULT NULL,
  `Qc` double DEFAULT NULL,
  `Qsig` double DEFAULT NULL,
  `Sa` double DEFAULT NULL,
  `Sb` double DEFAULT NULL,
  `Sc` double DEFAULT NULL,
  `Ssig` double DEFAULT NULL,
  `PFa` double DEFAULT NULL,
  `PFb` double DEFAULT NULL,
  `PFc` double DEFAULT NULL,
  `PFsig` double DEFAULT NULL,
  `Freq` double DEFAULT NULL,
  `kWh` double DEFAULT NULL,
  `kVARh` double DEFAULT NULL,
  `BusTemp1` double DEFAULT NULL,
  `BusTemp2` double DEFAULT 30,
  `BusTemp3` double DEFAULT 30,
  `OilTemp` double DEFAULT 30,
  `WTITemp1` double DEFAULT 30,
  `WTITemp2` double DEFAULT 30,
  `WTITemp3` double DEFAULT 30,
  `Press` double DEFAULT NULL,
  `Level` smallint(6) DEFAULT NULL,
  `KRateda` smallint(6) DEFAULT 1,
  `deRatinga` double DEFAULT 100,
  `KRatedb` smallint(6) DEFAULT NULL,
  `deRatingb` double DEFAULT NULL,
  `KRatedc` smallint(6) DEFAULT NULL,
  `deRatingc` double DEFAULT NULL,
  `H2ppm` smallint(6) DEFAULT NULL,
  `Moistureppm` smallint(6) DEFAULT NULL,
  `UnbalanceUV` double DEFAULT NULL,
  `UnbalanceVW` double DEFAULT NULL,
  `UnbalanceUW` double DEFAULT NULL,
  PRIMARY KEY (`data_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `temp_reading_data_realtime` */

/*Table structure for table `temp_voltage_harmonic` */

DROP TABLE IF EXISTS `temp_voltage_harmonic`;

CREATE TABLE `temp_voltage_harmonic` (
  `Phase` smallint(6) DEFAULT NULL,
  `1st` double DEFAULT NULL,
  `3rd` double DEFAULT NULL,
  `5th` double DEFAULT NULL,
  `7th` double DEFAULT NULL,
  `9th` double DEFAULT NULL,
  `11th` double DEFAULT NULL,
  `13th` double DEFAULT NULL,
  `15th` double DEFAULT NULL,
  `17th` double DEFAULT NULL,
  `19th` double DEFAULT NULL,
  `21th` double DEFAULT NULL,
  `23th` double DEFAULT NULL,
  `25th` double DEFAULT NULL,
  `27th` double DEFAULT NULL,
  `29th` double DEFAULT NULL,
  `31th` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `temp_voltage_harmonic` */

insert  into `temp_voltage_harmonic`(`Phase`,`1st`,`3rd`,`5th`,`7th`,`9th`,`11th`,`13th`,`15th`,`17th`,`19th`,`21th`,`23th`,`25th`,`27th`,`29th`,`31th`) values 
(1,100,0,0,0.5,0,0,0,0,0,0,0,0,0,0,0,0),
(2,100,0,0,0.5,0,0,0,0,0,0,0,0,0,0,0,0),
(3,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);

/*Table structure for table `transformer_data` */

DROP TABLE IF EXISTS `transformer_data`;

CREATE TABLE `transformer_data` (
  `trafoId` int(11) NOT NULL AUTO_INCREMENT,
  `raspiSerialNo` varchar(50) DEFAULT NULL,
  `trafoSerialNo` text DEFAULT NULL,
  `ratedPower` int(5) DEFAULT NULL,
  `ratedHighVoltage` int(3) DEFAULT NULL,
  `ratedLowVoltage` int(3) DEFAULT NULL,
  `ratedCurrentHighVoltage` float DEFAULT NULL,
  `ratedCurrentLowVoltage` float DEFAULT NULL,
  `frequency` int(3) DEFAULT NULL,
  `vectorGroup` varchar(20) DEFAULT NULL,
  `phase` int(1) DEFAULT NULL,
  `tapType` varchar(5) DEFAULT NULL,
  `impedance` int(3) DEFAULT 3,
  `noLoadLoss` int(5) DEFAULT NULL,
  `fullLoadLoss` int(5) DEFAULT NULL,
  `tapPercentagePlus` float DEFAULT NULL,
  `tapPercentageMinus` float DEFAULT NULL,
  `tapNumberPlus` int(2) DEFAULT NULL,
  `tapNumberMinus` int(2) DEFAULT NULL,
  `topOilHv` float DEFAULT NULL,
  `topOilLv` float DEFAULT NULL,
  `gradientHv` float DEFAULT NULL,
  `gradientLv` float DEFAULT NULL,
  `windTempHv` float DEFAULT NULL,
  `windTempLv` float DEFAULT NULL,
  `losses` float DEFAULT NULL,
  `hotspotFactor` float DEFAULT NULL,
  `ctRatio` int(3) DEFAULT NULL,
  `coolingMode` varchar(15) DEFAULT NULL,
  `status` tinyint(3) DEFAULT NULL,
  `SuddenPressure` int(3) DEFAULT NULL,
  `latitude` float DEFAULT NULL,
  `longitude` float DEFAULT NULL,
  `intervalDelay` tinyint(3) DEFAULT NULL,
  `krated` tinyint(1) DEFAULT NULL,
  `lastSyncTimestamp` datetime DEFAULT NULL,
  `version` tinyint(1) DEFAULT 1,
  `imageFileName` varchar(50) DEFAULT NULL,
  `productionStatus` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`trafoId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `transformer_data` */

/*Table structure for table `transformer_settings` */

DROP TABLE IF EXISTS `transformer_settings`;

CREATE TABLE `transformer_settings` (
  `trafoId` int(11) NOT NULL,
  `voltageLowTripTreshold` int(3) DEFAULT NULL,
  `voltageLowTripValue` float DEFAULT NULL,
  `voltageLowAlarmTreshold` int(3) DEFAULT NULL,
  `voltageLowAlarmValue` float DEFAULT NULL,
  `voltageHighTripTreshold` int(3) DEFAULT NULL,
  `voltageHighTripValue` float DEFAULT NULL,
  `voltageHighAlarmTreshold` int(3) DEFAULT NULL,
  `voltageHighAlarmValue` float DEFAULT NULL,
  `voltageUnbalanceHighAlarmTreshold` int(3) DEFAULT NULL,
  `voltageUnbalanceHighTripTreshold` int(3) DEFAULT NULL,
  `frequencyLowTripTreshold` int(3) DEFAULT NULL,
  `frequencyLowAlarmTreshold` int(3) DEFAULT NULL,
  `frequencyHighTripTreshold` int(3) DEFAULT NULL,
  `frequencyHighAlarmTreshold` int(3) DEFAULT NULL,
  `topOilHighAlarmTreshold` int(3) DEFAULT NULL,
  `topOilHighTripTreshold` int(3) DEFAULT NULL,
  `windTempHighAlarmTreshold` int(3) DEFAULT NULL,
  `windTempHighTripTreshold` int(3) DEFAULT NULL,
  `powerFactorLowAlarmTreshold` float DEFAULT NULL,
  `powerFactorLowTripTreshold` float DEFAULT NULL,
  `currentHighAlarmTreshold` int(3) DEFAULT NULL,
  `currentHighTripTreshold` int(3) DEFAULT NULL,
  `tankPressureHighTripTreshold` float DEFAULT NULL,
  `tankPressureHighAlarmTreshold` float DEFAULT NULL,
  `busTempHighAlarmTreshold` int(3) DEFAULT NULL,
  `busTempHighTripTreshold` int(3) DEFAULT NULL,
  `thdCurrentAlarmTreshold` int(11) DEFAULT NULL,
  `thdCurrentTripTreshold` int(11) DEFAULT NULL,
  `thdVoltageAlarmTreshold` int(11) DEFAULT NULL,
  `thdVoltageTripTreshold` int(11) DEFAULT NULL,
  `IneutralHighAlarmTreshold` int(3) DEFAULT NULL,
  `IneutralHighTripTreshold` int(3) DEFAULT NULL,
  `H2ppmHighAlarmTreshold` int(3) DEFAULT NULL,
  `H2ppmHighTripTreshold` int(3) DEFAULT NULL,
  `MoistureppmHighAlarmTreshold` int(3) DEFAULT NULL,
  `MoistureppmHighTripTreshold` int(3) DEFAULT NULL,
  PRIMARY KEY (`trafoId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `transformer_settings` */

/*Table structure for table `transformer_status` */

DROP TABLE IF EXISTS `transformer_status`;

CREATE TABLE `transformer_status` (
  `trafoId` int(11) NOT NULL AUTO_INCREMENT,
  `Vab` tinyint(4) DEFAULT NULL,
  `Vbc` tinyint(4) DEFAULT NULL,
  `Vca` tinyint(4) DEFAULT NULL,
  `Current1` tinyint(4) DEFAULT NULL,
  `Current2` tinyint(4) DEFAULT NULL,
  `Current3` tinyint(4) DEFAULT NULL,
  `Ineutral` tinyint(4) DEFAULT NULL,
  `THDVoltage1` tinyint(4) DEFAULT NULL,
  `THDVoltage2` tinyint(4) DEFAULT NULL,
  `THDVoltage3` tinyint(4) DEFAULT NULL,
  `THDCurrent1` tinyint(4) DEFAULT NULL,
  `THDCurrent2` tinyint(4) DEFAULT NULL,
  `THDCurrent3` tinyint(4) DEFAULT NULL,
  `PF` tinyint(4) DEFAULT NULL,
  `Freq` tinyint(4) DEFAULT NULL,
  `BusTemp1` tinyint(4) DEFAULT NULL,
  `BusTemp2` tinyint(4) DEFAULT NULL,
  `BusTemp3` tinyint(4) DEFAULT NULL,
  `OilTemp` tinyint(4) DEFAULT NULL,
  `WTITemp1` tinyint(4) DEFAULT NULL,
  `WTITemp2` tinyint(4) DEFAULT NULL,
  `WTITemp3` tinyint(4) DEFAULT NULL,
  `Pressure` tinyint(4) DEFAULT NULL,
  `OilLevel` tinyint(4) DEFAULT NULL,
  `H2ppm` tinyint(4) DEFAULT NULL,
  `Moistureppm` tinyint(4) DEFAULT NULL,
  `Uab` tinyint(4) DEFAULT NULL,
  `Ubc` tinyint(4) DEFAULT NULL,
  `Uca` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`trafoId`),
  KEY `No` (`trafoId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `transformer_status` */

/*Table structure for table `trip_settings` */

DROP TABLE IF EXISTS `trip_settings`;

CREATE TABLE `trip_settings` (
  `trafoId` tinyint(1) NOT NULL AUTO_INCREMENT,
  `voltage` tinyint(1) DEFAULT NULL,
  `voltageUnbalance` tinyint(1) DEFAULT NULL,
  `frequency` tinyint(1) DEFAULT NULL,
  `topOilTemp` tinyint(1) DEFAULT NULL,
  `busTemp` tinyint(1) DEFAULT NULL,
  `powerFactor` tinyint(1) DEFAULT NULL,
  `current` tinyint(1) DEFAULT NULL,
  `pressure` tinyint(1) DEFAULT NULL,
  `oilLevel` tinyint(1) DEFAULT NULL,
  `WTITemp` tinyint(1) DEFAULT NULL,
  `THDCurrent` tinyint(1) DEFAULT NULL,
  `THDVoltage` tinyint(1) DEFAULT NULL,
  `Ineutral` tinyint(1) DEFAULT NULL,
  `H2ppm` tinyint(1) DEFAULT NULL,
  `Moistureppm` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`trafoId`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4;

/*Data for the table `trip_settings` */

/*Table structure for table `trip_status` */

DROP TABLE IF EXISTS `trip_status`;

CREATE TABLE `trip_status` (
  `trafoId` tinyint(1) NOT NULL AUTO_INCREMENT,
  `Vab` tinyint(1) DEFAULT NULL,
  `Vbc` tinyint(1) DEFAULT NULL,
  `Vca` tinyint(1) DEFAULT NULL,
  `Current1` tinyint(1) DEFAULT NULL,
  `Current2` tinyint(1) DEFAULT NULL,
  `Current3` tinyint(1) DEFAULT NULL,
  `Ineutral` tinyint(1) DEFAULT NULL,
  `THDVoltage1` tinyint(1) DEFAULT NULL,
  `THDVoltage2` tinyint(1) DEFAULT NULL,
  `THDVoltage3` tinyint(1) DEFAULT NULL,
  `THDCurrent1` tinyint(1) DEFAULT NULL,
  `THDCurrent2` tinyint(1) DEFAULT NULL,
  `THDCurrent3` tinyint(1) DEFAULT NULL,
  `PF` tinyint(1) DEFAULT NULL,
  `Freq` tinyint(1) DEFAULT NULL,
  `BusTemp1` tinyint(1) DEFAULT NULL,
  `BusTemp2` tinyint(1) DEFAULT NULL,
  `BusTemp3` tinyint(1) DEFAULT NULL,
  `OilTemp` tinyint(1) DEFAULT NULL,
  `WTITemp1` tinyint(1) DEFAULT NULL,
  `WTITemp2` tinyint(1) DEFAULT NULL,
  `WTITemp3` tinyint(1) DEFAULT NULL,
  `Pressure` tinyint(1) DEFAULT NULL,
  `OilLevel` tinyint(1) DEFAULT NULL,
  `H2ppm` tinyint(1) DEFAULT NULL,
  `Moistureppm` tinyint(1) DEFAULT NULL,
  `Uab` tinyint(1) DEFAULT NULL,
  `Ubc` tinyint(1) DEFAULT NULL,
  `Uca` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`trafoId`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4;

/*Data for the table `trip_status` */

/*Table structure for table `users` */

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` int(1) NOT NULL,
  `name` varchar(50) NOT NULL,
  `salt` varchar(5) NOT NULL,
  `status` int(1) NOT NULL COMMENT '9=super admin, 1=super user, 2=user',
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `users` */

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
