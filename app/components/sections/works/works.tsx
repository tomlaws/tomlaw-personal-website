export default function Works() {
    return (
        <div className="w-screen h-screen grid gap-3 lg:gap-5 grid-cols-3 grid-rows-5 lg:grid-cols-6 lg:grid-rows-3 p-3 lg:p-5">
            <div className="col-span-1 bg-red-50 rounded-3xl">
                1
            </div>
            <div className="col-span-2 lg:col-span-2 bg-blue-50 rounded-3xl">
                2
            </div>
            <div className="col-span-2 lg:col-span-1 lg:row-span-1 bg-blue-50 rounded-3xl">
                3
            </div>
            <div className="col-span-1 lg:col-span-2 row-span-2 bg-lime-50 rounded-3xl">
                4
            </div>
            <div className="col-span-2 row-span-2 bg-red-50 rounded-3xl">
                5
            </div>
            <div className="lg:col-span-2 row-span-1 bg-purple-50 rounded-3xl">
                6
            </div>
            <div className="col-span-2 lg:col-span-3 row-span-1 order-last lg:order-none bg-purple-50 rounded-3xl">
                7
            </div>
            <div className="col-span-1 row-span-1 bg-lime-50 rounded-3xl">
                8
            </div>
        </div>
    );
}