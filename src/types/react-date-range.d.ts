declare module 'react-date-range' {
  import { Component } from 'react';

  export interface DateRange {
    startDate: Date;
    endDate: Date;
    key?: string;
  }

  export interface RangeKeyDict {
    [key: string]: DateRange | undefined;
  }

  export interface DateRangePickerProps {
    ranges: DateRange[];
    onChange: (ranges: RangeKeyDict) => void;
    moveRangeOnFirstSelection?: boolean;
    months?: number;
    direction?: 'horizontal' | 'vertical';
    showDateDisplay?: boolean;
    showMonthAndYearPickers?: boolean;
    showSelectionPreview?: boolean;
    editableDateInputs?: boolean;
    dragSelectionEnabled?: boolean;
    fixedHeight?: boolean;
    calendarFocus?: 'forwards' | 'backwards';
    initialFocusedRange?: number[];
    disabledDates?: Date[];
    minDate?: Date;
    maxDate?: Date;
    dateDisplayFormat?: string;
    monthDisplayFormat?: string;
    weekdayDisplayFormat?: string;
    dayDisplayFormat?: string;
    weekStartsOn?: number;
    showPreview?: boolean;
    preview?: {
      startDate: Date;
      endDate: Date;
    };
    className?: string;
    classNames?: {
      dateRangeWrapper?: string;
      calendarWrapper?: string;
      dateDisplay?: string;
      dateDisplayItem?: string;
      dateDisplayItemActive?: string;
      monthAndYearWrapper?: string;
      monthAndYearPickers?: string;
      nextPrevButton?: string;
      month?: string;
      weekDays?: string;
      weekDay?: string;
      day?: string;
      dayNumber?: string;
      dayPassive?: string;
      dayToday?: string;
      dayStartOfWeek?: string;
      dayEndOfWeek?: string;
      daySelected?: string;
      dayInRange?: string;
      dayDisabled?: string;
      dayStartOfMonth?: string;
      dayEndOfMonth?: string;
      dayHovered?: string;
      dayActive?: string;
      dayBlockedMinMax?: string;
      dayBlockedCalendar?: string;
      dayBlockedOutsideMonth?: string;
      dayFirstInRange?: string;
      dayLastInRange?: string;
      definedRangesWrapper?: string;
      staticRanges?: string;
      staticRange?: string;
      staticRangeLabel?: string;
      staticRangeSelected?: string;
      inputRanges?: string;
      inputRange?: string;
      inputRangeInput?: string;
      inputRangeLabel?: string;
      dateRangePickerWrapper?: string;
      dateRangePicker?: string;
      dateRangePickerWrapperDraging?: string;
    };
    styles?: {
      [key: string]: React.CSSProperties;
    };
  }

  export class DateRangePicker extends Component<DateRangePickerProps> {}
}
