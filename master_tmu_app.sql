/*
SQLyog Community v13.2.1 (64 bit)
MySQL - 10.6.2-MariaDB-1:10.6.2+maria~focal : Database - master_tmu_app
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`master_tmu_app` /*!40100 DEFAULT CHARACTER SET utf8mb4 */;

USE `master_tmu_app`;

/*Table structure for table `company` */

DROP TABLE IF EXISTS `company`;

CREATE TABLE `company` (
  `company_id` int(11) NOT NULL AUTO_INCREMENT,
  `company_name` varchar(50) NOT NULL,
  `database_name` varchar(30) NOT NULL,
  `company_code` varchar(30) DEFAULT NULL,
  `company_key` varchar(50) DEFAULT NULL,
  `telegram_chat_id` varchar(25) DEFAULT NULL,
  `telegram_api_token` varchar(50) DEFAULT NULL,
  `status` tinyint(1) DEFAULT 1,
  `tmu_version` tinyint(1) DEFAULT 1,
  UNIQUE KEY `company_key` (`company_key`),
  KEY `company_id` (`company_id`)
) ENGINE=InnoDB AUTO_INCREMENT=92 DEFAULT CHARSET=utf8mb4;

/*Data for the table `company` */


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

/*Table structure for table `trafo_last_connection` */

DROP TABLE IF EXISTS `trafo_last_connection`;

CREATE TABLE `trafo_last_connection` (
  `raspi_serial_no` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_connection_time` datetime NOT NULL,
  PRIMARY KEY (`raspi_serial_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores the most recent connection timestamp for each Raspi device.';

/*Data for the table `trafo_last_connection` */


/*Table structure for table `user` */

DROP TABLE IF EXISTS `user`;

CREATE TABLE `user` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(30) DEFAULT NULL,
  `password` varchar(100) NOT NULL,
  `role` tinyint(4) NOT NULL,
  `salt` varchar(10) NOT NULL,
  `company_id` int(11) NOT NULL,
  `status` tinyint(1) NOT NULL,
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=150 DEFAULT CHARSET=utf8mb4;

/*Data for the table `user` */


/*Table structure for table `user_activity_log` */

DROP TABLE IF EXISTS `user_activity_log`;

CREATE TABLE `user_activity_log` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activity_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activity_description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `module` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trafo_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trafo_serial_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `old_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_value`)),
  `new_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_value`)),
  `ip_address` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_company_id` (`company_id`),
  KEY `idx_activity_type` (`activity_type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_trafo_id` (`trafo_id`)
) ENGINE=InnoDB AUTO_INCREMENT=555 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*Data for the table `user_activity_log` */

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
