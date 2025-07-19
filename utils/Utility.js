//format ngay gio
function formatDate(updatedAt) {
    const date = new Date(updatedAt);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${seconds} ${day}-${month}-${year}`;
}

//time message
function formatTimeFeedback(feedback) {
    const createdAtFeedback = new Date(feedback);
    const TimeNow = new Date();
    const timeElapsed = TimeNow - createdAtFeedback;

    const numberMinutesElapsed = Math.floor(timeElapsed / (1000 * 60));
    const numberHoursElapsed = Math.floor(timeElapsed / (1000 * 60 * 60));

    if (numberMinutesElapsed < 1) {
        return 'now';
    } else if (numberMinutesElapsed < 60) {
        return `${numberMinutesElapsed} minutes ago`;
    } else if (numberHoursElapsed < 24) {
        return `${numberHoursElapsed} hours ago`;
    } else {
        // xử lý nhiều ngày trở lên
        const numberDaysElapsed = Math.floor(numberHoursElapsed / 24);
        return `${numberDaysElapsed} days ago`;
    }
}

//format so (tien)
function numberFormat(number) {
    const formatter = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
        useGrouping: true,
    });

    let formattedNumber = formatter.format(number);
    // Loại bỏ phần thập phân nếu nó chỉ là .00
    if (formattedNumber.endsWith('.00')) {
        formattedNumber = formattedNumber.substring(0, formattedNumber.length - 3);
    }

    return formattedNumber;
}

module.exports = { formatDate, numberFormat, formatTimeFeedback};