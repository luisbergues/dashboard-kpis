import { describe, it, expect } from 'vitest';
import {
  parseCurrency,
  calculateConversionRate,
  calculateBudgetDeviation,
  calculateAverageValidationTime,
  calculateFileRequestsPercentage,
  predictBottlenecks,
  getDelayedProjectsCount,
  getProjectLocation
} from '../kpiCalculator';

describe('KPI Calculator Service Tests', () => {

  describe('getProjectLocation', () => {
    it('should parse location names in project name', () => {
      expect(getProjectLocation({ name: 'Miami Closet Installation' })).toBe('Miami');
      expect(getProjectLocation({ name: 'Boca Raton Office Cabinets' })).toBe('Boca Raton');
      expect(getProjectLocation({ name: 'Naples Custom Walk-In' })).toBe('Naples');
    });

    it('should fallback deterministically based on SO#', () => {
      expect(getProjectLocation({ so: '12000' })).toBe('Miami');
      expect(getProjectLocation({ so: '12001' })).toBe('Boca Raton');
      expect(getProjectLocation({ so: '12002' })).toBe('Naples');
      expect(getProjectLocation({ so: '12003' })).toBe('Miami');
    });
  });

  describe('parseCurrency', () => {
    it('should parse currency strings correctly', () => {
      expect(parseCurrency('$170,195.00')).toBe(170195);
      expect(parseCurrency('$30,490')).toBe(30490);
      expect(parseCurrency('-$5,000.50')).toBe(-5000.5);
      expect(parseCurrency(12500)).toBe(12500);
      expect(parseCurrency(null)).toBe(0);
      expect(parseCurrency(undefined)).toBe(0);
      expect(parseCurrency('')).toBe(0);
    });
  });

  describe('calculateConversionRate', () => {
    it('should calculate conversion rate correctly', () => {
      expect(calculateConversionRate(34, 21)).toBe(61.8);
      expect(calculateConversionRate(10, 0)).toBe(100.0);
      expect(calculateConversionRate(0, 5)).toBe(0.0);
      expect(calculateConversionRate(0, 0)).toBe(0.0);
      // handles strings
      expect(calculateConversionRate('15', '5')).toBe(75.0);
    });
  });

  describe('calculateBudgetDeviation', () => {
    it('should calculate budget deviation correctly', () => {
      expect(calculateBudgetDeviation('$170,195.00', '$407,437.00')).toBe(41.8);
      expect(calculateBudgetDeviation(50, 200)).toBe(25.0);
      expect(calculateBudgetDeviation(0, 500)).toBe(0.0);
      expect(calculateBudgetDeviation(100, 0)).toBe(0.0);
    });
  });

  describe('calculateAverageValidationTime', () => {
    it('should calculate average validation time in hours', () => {
      const checks = {
        '1001': { started: '2026-06-10T08:00:00.000Z', finished: '2026-06-10T12:00:00.000Z' }, // 4 hours
        '1002': { started: '2026-06-10T10:00:00.000Z', finished: '2026-06-10T11:30:00.000Z' }, // 1.5 hours
        '1003': { started: '2026-06-10T12:00:00.000Z' }, // in progress (ignored)
        '1004': null, // invalid (ignored)
      };
      // Total hours = 5.5, count = 2 -> average = 2.75 -> 2.8 hours
      expect(calculateAverageValidationTime(checks)).toBe(2.8);
    });

    it('should return 0 if there are no completed checks', () => {
      const checks = {
        '1001': { started: '2026-06-10T08:00:00.000Z' }
      };
      expect(calculateAverageValidationTime(checks)).toBe(0.0);
      expect(calculateAverageValidationTime(null)).toBe(0.0);
    });
  });

  describe('calculateFileRequestsPercentage', () => {
    it('should count file-request (CAD-related) notes grouped by designer', () => {
      const notes = [
        { designer: 'Russell Reiner\nrreiner@jlclosets.com', notes: 'WAITING ACCESORY SHEETS - MIRROR' }, // not a file request
        { designer: 'Russell Reiner\nrreiner@jlclosets.com', notes: 'THE KCD FILE IS INCONSISTENT WITH THE PDF PLANS' }, // file request (kcd/file/inconsistent)
        { designer: 'Malanie Dalfrey\nmdalfrey@jlclosets.com', notes: 'WAITING MEASUREMENTS FROM SITE' }, // file request (measure)
        { designer: 'Melissa Barker', notes: 'WAITING FILE' }, // file request (file)
        { designer: 'Russell Reiner', notes: 'WAITING FILE - LED LIGHT - DOVETAIL - INSERT DRAWER' }, // file request (file)
      ];

      const result = calculateFileRequestsPercentage(notes);

      expect(result.totalRequests).toBe(4);
      expect(result.designerStats['Russell Reiner'].requests).toBe(2);
      expect(result.designerStats['Malanie Dalfrey'].requests).toBe(1);
      expect(result.designerStats['Melissa Barker'].requests).toBe(1);
    });

    it('should compute percentage against a designer\'s active project count', () => {
      const notes = [
        { designer: 'Russell Reiner', notes: 'WAITING FILE' }, // 1 file request
      ];
      const projects = [
        { eng: 'Russell Reiner' },
        { eng: 'Russell Reiner' },
        { eng: 'Russell Reiner' },
        { eng: 'Russell Reiner' }, // 4 active projects -> 1/4 = 25%
      ];

      const result = calculateFileRequestsPercentage(notes, projects);

      expect(result.designerStats['Russell Reiner'].requests).toBe(1);
      expect(result.designerStats['Russell Reiner'].total).toBe(4);
      expect(result.designerStats['Russell Reiner'].percentage).toBe(25.0);
    });

    it('should return empty result if no notes are provided', () => {
      const result = calculateFileRequestsPercentage([]);
      expect(result.totalRequests).toBe(0);
      expect(Object.keys(result.designerStats).length).toBe(0);
    });
  });

  describe('predictBottlenecks', () => {
    it('should predict bottleneck alerts', () => {
      const projects = [
        // Naples installation daily overload (>2 projects)
        { so: '11801', name: 'Hale Residence', install: '2026-06-12', eng: 'Julieta', status: 'Nesting' },
        { so: '11802', name: 'Prince Residence', install: '2026-06-12', eng: 'Luis', status: 'Nesting' },
        { so: '11803', name: 'Santos Residence', install: '2026-06-12', eng: 'Andres', status: 'Completed' },
        
        // Pre-production installation scheduled in next 7 days (installation warning)
        { so: '11854', name: 'Noah Hale', install: '2026-06-15', eng: 'Julieta', status: 'Engineering' },
        
        // Designer Julieta overloading count (>3 in pre-production status: engineering/check/review)
        { so: '12001', name: 'Proj A', install: '2026-06-25', eng: 'Julieta', status: 'Check' },
        { so: '12002', name: 'Proj B', install: '2026-06-26', eng: 'Julieta', status: 'Review' },
        { so: '12003', name: 'Proj C', install: '2026-06-27', eng: 'Julieta', status: 'Engineering' },
      ];

      const alerts = predictBottlenecks(projects, '2026-06-11');

      // 1. Capacity overload alert for 2026-06-12
      const capacityAlert = alerts.find(a => a.type === 'capacity_bottleneck');
      expect(capacityAlert).toBeDefined();
      expect(capacityAlert.date).toBe('2026-06-12');

      // 2. Delayed installation risk alert for Noah Hale (#11854)
      const delayAlert = alerts.find(a => a.type === 'delayed_installation_risk');
      expect(delayAlert).toBeDefined();
      expect(delayAlert.date).toBe('2026-06-15');

      // 3. Designer overload for Julieta (4 projects in pre-prod)
      const overloadAlert = alerts.find(a => a.type === 'designer_overload');
      expect(overloadAlert).toBeDefined();
      expect(overloadAlert.designer).toBe('Julieta');
    });
  });

  describe('getDelayedProjectsCount', () => {
    it('should count projects ON HOLD for more than 3 days', () => {
      const projects = [
        { so: '11854', name: 'Noah Hale', install: '2026-06-18', eng: 'Julieta', status: 'ON HOLD' },
        { so: '12275', name: 'Tess Sprechman', install: '2026-07-06', eng: 'Russell', status: 'ON HOLD' },
        { so: '12303', name: 'Maria Montalbano', install: '2026-06-30', eng: 'Jose', status: 'Check' }, // active
      ];

      const history = {
        '11854': [
          { type: 'status_change', status: 'ON HOLD', timestamp: '2026-06-05T10:00:00.000Z' } // Hold placed 6 days before June 11
        ],
        '12275': [
          { type: 'status_change', status: 'ON HOLD', timestamp: '2026-06-10T12:00:00.000Z' } // Hold placed 1 day before June 11 (ignored)
        ]
      };

      const count = getDelayedProjectsCount(projects, history, '2026-06-11T12:00:00.000Z');
      expect(count).toBe(1); // Only 11854 has been on hold for > 3 days
    });
  });

});
