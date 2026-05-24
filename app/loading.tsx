export default function Loading() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
            <div className="w-12 h-12 border-4 border-gray-100 border-t-black rounded-full animate-spin"></div>
        </div>
    );
}
